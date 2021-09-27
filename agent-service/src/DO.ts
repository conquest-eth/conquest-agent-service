import type {Env} from './types';

// needed because of : https://github.com/cloudflare/durable-objects-typescript-rollup-esm/issues/3
type State = DurableObjectState & {blockConcurrencyWhile: (func: () => Promise<void>) => void};


export abstract class DO {
  state: State;
  env: Env;

  constructor(state: State, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    let url = new URL(request.url);
    const path = url.pathname.substr(1).split('/');
    const fnc = path[0];
    const self = this as unknown as {[funcName: string]: (path: string[], data: Object | string | number) => Promise<Response>};
    if (self[fnc]) {
        try {
            const json = await request.json();
            const response = await self[fnc](path.slice(1), json);
            console.log(response);
            return response;
        } catch(e: unknown) {
            const error = e as {message?: string}
            let message = `Error happen while calling ${fnc}`;
            if (error.message) {
                message = error.message;
            } else {
                message = message + '  :  ' + e;
            }
            return new Response(message, {status: 501});    
        }
        
    } else {
        return new Response("Not found", {status: 404});
    }
  }
  
}
