import { InvalidMethod, UnknownRequestType } from './errors';
import type {Env, CronTrigger} from './types';

const BASE_URL = 'http://127.0.0.1';

// In order for the workers runtime to find the class that implements
// our Durable Object namespace, we must export it from the root module.
export { RevealQueue } from './RevealQueue'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env)
    } catch (e: unknown) {
      // console.error('ERROR', e);
      const message = (e as {message: string}).message;
      if (message) {
        return new Response(message);
      } else {
        return new Response(e as string);
      }

    }
  },

  async scheduled(trigger: CronTrigger, env: Env, event: ScheduledEvent) {

    const id = env.REVEAL_QUEUE.idFromName('A');
    const obj = env.REVEAL_QUEUE.get(id);
    if (trigger.cron === '* * * * *') {
      console.log('execute...');
      event.waitUntil(obj.fetch(`${BASE_URL}/execute`));
    } else if (trigger.cron === '*/1 * * * *') {
      console.log('checkPendingTransactions...');
      event.waitUntil(obj.fetch(`${BASE_URL}/checkPendingTransactions`));
    } else if (trigger.cron === '*/2 * * * *') {
      console.log('syncAccountBalances...');
      event.waitUntil(obj.fetch(`${BASE_URL}/syncAccountBalances`));
    }
  },
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const id = env.REVEAL_QUEUE.idFromName('A')
  const obj = env.REVEAL_QUEUE.get(id)

  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname.substr(1).split('/');
  const fnc = path[0];
  if (fnc === 'getTransactionInfo') {
    if (method !== 'GET') {
      return InvalidMethod();
    }
    let resp = await obj.fetch(url.toString(), request)
    return resp;
  } else if (fnc === 'queueReveal') {
    if (method !== 'POST') {
      return InvalidMethod();
    }
    let resp = await obj.fetch(url.toString(), request)
    return resp;
  } else if (fnc === 'register') {
    if (method !== 'POST') {
      return InvalidMethod();
    }
    let resp = await obj.fetch(url.toString(), request)
    return resp;
  } else if (fnc === 'account') {
    if (method !== 'GET') {
      return InvalidMethod();
    }
    let resp = await obj.fetch(url.toString(), request)
    return resp;
  }
  return UnknownRequestType();
}

