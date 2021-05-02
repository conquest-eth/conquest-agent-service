import {Client, defaultExchanges} from '@urql/core';
import type {OperationContext, OperationResult} from '@urql/core';
import {devtoolsExchange} from '@urql/devtools';
import type {DocumentNode} from 'graphql';
import {pipe, fromValue, concat, scan, map, subscribe} from 'wonka';
import {initialState} from './constants';
import type {sourceT} from 'wonka/dist/types/src/Wonka_types.gen';

export type InternalQueryState<T> = {
  fetching: boolean;
  stale: boolean;
  data: T;
  error: unknown;
  extensions: Record<string, unknown>;
};

const exchanges = defaultExchanges.concat();

if (import.meta.env.MODE === 'development') {
  exchanges.unshift(devtoolsExchange);
}

export class EndPoint {
  private client: Client;
  constructor(url: string) {
    // TODO move that out of the constructor
    try {
      const queryParams = new URLSearchParams(location.search);
      if (queryParams.has('subgraph')) {
        url = queryParams.get('subgraph') as string;
      }
    } catch (e) {}

    if (!url) {
      console.error(`no url specific either at build time or runtim (through query params) for subgraph`);
    }

    this.client = new Client({
      url,
      exchanges,
    });
  }

  mutate<Data = unknown, Variables extends Record<string, unknown> = Record<string, unknown>>(args: {
    query: DocumentNode | string;
    variables?: Variables;
    context?: Partial<OperationContext>;
  }): Promise<OperationResult<Data>> {
    return this.client.mutation(args.query, args.variables, args.context).toPromise();
  }

  query<
    Data extends Record<string, unknown>,
    Variables extends Record<string, unknown> = Record<string, unknown>
  >(args: {
    query: DocumentNode | string;
    variables?: Variables;
    context?: Partial<OperationContext>;
  }): Promise<OperationResult<Data, Variables>> {
    return this.client.query(args.query, args.variables, args.context).toPromise();
  }

  async queryList<T>(
    queryString: string,
    field: string,
    variables: Record<string, unknown>,
    getLastId?: (entries: T[]) => string,
    context?: Partial<OperationContext>
  ): Promise<T[]> {
    const fields = field.split('.');
    const first = 100;
    let lastId = '0x0';
    let numEntries = first;
    let entries: T[] = [];
    while (numEntries === first) {
      const result = await this.client.query(queryString, {first, lastId, ...variables}, context).toPromise();
      if (result.error) {
        throw new Error(result.error.message);
      }
      const data = result.data;

      // TODO deep access on root array
      let newEntries = [];
      if (data && field) {
        let tmp = data;
        for (const fieldPart of fields) {
          tmp = tmp[fieldPart];
        }
        newEntries = tmp;
      }

      numEntries = newEntries.length;
      if (numEntries > 0) {
        const newLastId = getLastId !== undefined ? getLastId(entries) : newEntries[numEntries - 1].id;
        if (lastId === newLastId) {
          console.log('same query, stop');
          break;
        }
        lastId = newLastId;
      }
      entries = entries.concat(newEntries);
    }
    return entries;
  }

  subscribeToQuery<
    Data extends Record<string, unknown>,
    Variables extends Record<string, unknown> = Record<string, unknown>
  >(args: {
    query: DocumentNode | string;
    variables?: Variables;
    context?: Partial<OperationContext>;
  }): {
    subscribe: (value: (value: InternalQueryState<Data>) => void) => () => void;
  } {
    const queryResult$ = pipe(
      concat([
        fromValue({fetching: true, stale: false}),
        pipe(
          this.client.query(args.query, args.variables, args.context),
          map(({stale, data, error, extensions}) => ({
            fetching: false,
            stale: !!stale,
            data,
            error,
            extensions,
          }))
        ),
        fromValue({fetching: false, stale: false}),
      ]),
      scan(
        (result, partial) => ({
          ...result,
          ...partial,
        }),
        initialState
      )
    );

    return {
      subscribe(onValue) {
        return pipe(queryResult$ as sourceT<InternalQueryState<Data>>, subscribe(onValue)).unsubscribe;
      },
    };
  }
}
