import { readFile } from 'node:fs/promises';
import { eufyStateDir } from '../model/eufyWrapper';
import Koa from 'koa';
import Router from '@koa/router';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TriggerService } from './triggerService';

export function startDashboard(
  triggers: TriggerService,
  sources: Record<string, () => Promise<string>>,
) {
  const router = new Router();
  for (const [route, file, type] of [
    ['/', 'index.html', 'html'],
    ['/dashboard.js', 'dashboard.js', 'application/javascript'],
    ['/dashboard.css', 'dashboard.css', 'css'],
  ]) {
    const body = readFileSync(join(__dirname, '../../web', file), 'utf8');
    router.get(route, (ctx) => {
      ctx.type = type;
      ctx.body = body;
    });
  }
  router.get('/eufy/maps/:key', async (ctx) => {
    if (!/^[a-f0-9]{64}$/.test(ctx.params.key)) ctx.throw(404);
    try {
      ctx.body = await readFile(join(eufyStateDir, ctx.params.key + '.png'));
      ctx.type = 'image/png';
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') ctx.throw(404);
      throw error;
    }
  });
  router.get('/devices', async (ctx) => {
    ctx.body = (await triggers.deviceCache.listDevices()).map(
      ({
        id,
        name,
        vendor,
        type,
        status,
        lastUpdated,
        batteryPercent,
        mapUpdated,
      }) => ({
        id,
        name,
        vendor,
        type,
        status,
        lastUpdated,
        batteryPercent,
        mapUpdated,
      }),
    );
  });
  router.get('/trygrs', (ctx) => {
    ctx.body = triggers.listTriggers().map(({ ID, data }) => ({
      id: ID,
      condition: data.triggerType,
      value: data.triggerValue,
      action: data.action,
      target: data.affectedDeviceId,
      actionValue: data.actionValue,
      offset: data.triggerOffset,
      chain: data.chainDeviceId,
    }));
  });
  let refreshing: Promise<string[]> | undefined;
  router.post('/devices/refresh', async (ctx) => {
    if (
      ctx.get('X-Trygr-Refresh') !== '1' ||
      (ctx.get('Origin') && ctx.get('Origin') !== ctx.origin)
    )
      ctx.throw(403);
    refreshing ??= Promise.all(
      Object.entries(sources).map(async ([name, refresh]) => {
        try {
          return name + ' · ' + (await refresh());
        } catch {
          return name + ' · Refresh failed';
        }
      }),
    ).finally(() => {
      refreshing = undefined;
    });
    ctx.body = { results: await refreshing };
  });
  const app = new Koa();
  app.use(async (ctx, next) => {
    ctx.set('Cache-Control', 'no-store');
    ctx.set(
      'Content-Security-Policy',
      "default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    );
    await next();
  });
  app.use(router.routes()).use(router.allowedMethods());
  return app.listen(
    Number(process.env.TRYGR_DASHBOARD_PORT || 3334),
    process.env.TRYGR_DASHBOARD_HOST || '0.0.0.0',
  );
}
