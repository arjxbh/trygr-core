import { brmeshTarget, listBrmesh } from '../model/brmeshWrapper';
import koa from 'koa';
import router from '@koa/router';
import { koaBody } from 'koa-body';
import joi from 'joi';
import Logger from 'bunyan';
import { TriggerService, type Trigger } from './triggerService';
import { getLogger } from '../service/loggingService';

import { EcoFlowWrapper } from '../model/ecoflowWrapper';

const triggerSchema = joi.object<Trigger>({
  affectedDeviceId: joi
    .alternatives()
    .try(
      joi.string().alphanum(),
      joi.string().pattern(brmeshTarget),
      joi.string().pattern(/^matter:\d{1,20}:\d{1,5}$/),
      joi.string().pattern(/^kasa-name:.{1,100}$/),
    )
    .required(),
  triggerType: joi.string().alphanum().required(),
  triggerValue: [joi.string(), joi.number()],
  action: joi.string().alphanum().required(),
  actionValue: [joi.string().alphanum(), joi.number()],
});

export class ApiService {
  app: koa;
  router: router;
  triggers: TriggerService;
  logger: Logger;

  constructor(triggers: TriggerService, port?: number) {
    this.logger = getLogger('API');
    this.app = new koa();
    this.router = new router();
    this.triggers = triggers;

    this.#createRoutes();

    this.app.use(this.router.routes()).use(this.router.allowedMethods());

    const apiPort = port || 3333;

    this.logger.info(`api listening on port ${apiPort}`);
    this.app.listen(apiPort, process.env.TRYGR_API_HOST || '127.0.0.1');
  }

  #createRoutes = () => {
    this.router.get('/brmesh', async (ctx) => {
      try {
        ctx.body = { status: 'ready', lights: await listBrmesh() };
      } catch (error) {
        const status =
          error instanceof Error &&
          ['hub_required', 'invalid_hostname'].includes(error.message)
            ? error.message
            : 'hub_unavailable';
        ctx.status = 503;
        ctx.body = { status };
      }
    });
    const ecoflow = new EcoFlowWrapper();
    this.router.get('/ecoflow', async (ctx) => {
      const snapshot = await ecoflow.snapshot();
      ctx.status = snapshot.status === 'ready' ? 200 : 503;
      ctx.body = snapshot;
    });
    this.router.get('/solar', (ctx) => {
      const solar = this.triggers.getSolarWindow();
      ctx.status = solar ? 200 : 503;
      ctx.body = solar ?? { error: 'Location unavailable' };
    });
    this.router.get('/health', async (ctx) => {
      await this.triggers.deviceCache.cache.ping();
      ctx.body = { service: 'trygr', pid: process.pid };
    });
    this.router.get('get-triggers', '/triggers', (ctx) => {
      ctx.body = this.triggers.listTriggers();
    });

    this.router.get(
      'get-trigger-by-temp',
      '/trigger/temperature/:temperature',
      async (ctx) => {
        const paramSchema = joi.object({
          temperature: joi.number().required(),
        });
        const validation = paramSchema.validate(ctx.params);
        if (validation.error) return (ctx.body = validation.error);

        const { temperature } = ctx.params;
        ctx.body = await this.triggers.getTemperatureHits(
          parseInt(temperature, 10),
        );
      },
    );

    this.router.post('create-trigger', '/trigger/create', koaBody(), (ctx) => {
      const validation = triggerSchema.validate(ctx.request.body);
      if (validation.error) return (ctx.body = validation.error);

      const newTriggerId = this.triggers.createTrigger(validation.value);
      ctx.body = { id: newTriggerId };
    });
  };
}
