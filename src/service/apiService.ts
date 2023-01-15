import koa from 'koa';
import router from '@koa/router';
import { TriggerService } from './triggerService';

export class ApiService {
  app: koa;
  router: router;
  triggers: TriggerService;

  constructor(triggers: TriggerService, port?: number) {
    this.app = new koa();
    this.router = new router();
    this.triggers = triggers;

    this.#createRoutes();

    this.app.use(this.router.routes()).use(this.router.allowedMethods());

    const apiPort = port || 3333;

    console.log(`api listening on port ${apiPort}`);
    this.app.listen(apiPort);
  }

  #createRoutes = () => {
    this.router.get('get-triggers', '/triggers', (ctx) => {
      ctx.body = this.triggers.listTriggers();
    });
  };
}
