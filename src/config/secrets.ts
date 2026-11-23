import { randomUUID } from 'node:crypto';
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function secretPath(name: string) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) throw new Error('Invalid secret name');
  const dir =
    process.env.TRYGR_SECRET_DIR ||
    join(homedir(), '.config', 'trygr', 'secrets');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const info = lstatSync(dir);
  if (!info.isDirectory() || info.uid !== process.getuid?.())
    throw new Error('Invalid Trygr secret directory');
  chmodSync(dir, 0o700);
  return join(dir, name);
}

export function readSetting(name: string): string {
  const path = secretPath(name);
  try {
    const info = lstatSync(path);
    if (
      !info.isFile() ||
      info.uid !== process.getuid?.() ||
      info.mode & 0o077
    ) {
      throw new Error('Trygr settings must be private regular files');
    }
    return readFileSync(path, 'utf8').replace(/\r?\n$/, '');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return process.env[name] || process.env[name.toLowerCase()] || '';
  }
}

export function writeSecret(name: string, value: string) {
  if (!value.trim()) throw new Error('Empty secret');
  const path = secretPath(name);
  const temp = path + '.' + randomUUID();
  try {
    writeFileSync(temp, value, { flag: 'wx', mode: 0o600, flush: true });
    renameSync(temp, path);
  } finally {
    rmSync(temp, { force: true });
  }
}
