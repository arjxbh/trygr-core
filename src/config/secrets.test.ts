import { mkdtempSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@jest/globals';
import { readSetting, writeSecret } from './secrets';

test('rotated credentials survive reload and override the bootstrap environment', () => {
  const dir = mkdtempSync(join(tmpdir(), 'trygr-session-'));
  const old = process.env.TRYGR_SECRET_DIR;
  process.env.TRYGR_SECRET_DIR = dir;
  process.env.TRYGR_TEST_TOKEN = 'seed';
  try {
    expect(readSetting('TRYGR_TEST_TOKEN')).toBe('seed');
    writeSecret('TRYGR_TEST_TOKEN', 'first');
    writeSecret('TRYGR_TEST_TOKEN', 'second');
    expect(readSetting('TRYGR_TEST_TOKEN')).toBe('second');
    expect(statSync(join(dir, 'TRYGR_TEST_TOKEN')).mode & 0o777).toBe(0o600);
    expect(statSync(dir).mode & 0o777).toBe(0o700);
  } finally {
    delete process.env.TRYGR_TEST_TOKEN;
    if (old) process.env.TRYGR_SECRET_DIR = old;
    else delete process.env.TRYGR_SECRET_DIR;
    rmSync(dir, { recursive: true });
  }
});
