import type {Invalidator, Subscriber, Unsubscriber} from 'web3w/dist/esm/utils/internals';
import {SUBGRAPH_ENDPOINT} from '$lib/blockchain/subgraph';
import type {QueryState, QueryStore} from '$lib/utils/stores/graphql';
import {HookedQueryStore} from '$lib/utils/stores/graphql';
import type {EndPoint} from '$lib/utils/graphql/endpoint';
import {chainTempo} from '$lib/blockchain/chainTempo';
import type { Writable } from 'svelte/store';
import { writable } from 'svelte/store';

export type PlanetQueryState = {
  id: string;
  owner: {id: string};
  numSpaceships: string;
  lastUpdated: string;
  exitTime: string;
  active: boolean;
  reward: string;
};

export type PlanetContractState = {
  id: string;
  owner: string;
  numSpaceships: number;
  lastUpdated: number;
  exitTime: number;
  active: boolean;
  reward: string;
};

export type SpaceQueryResult = {
  planets: PlanetQueryState[];
  space?: {minX: string; maxX: string; minY: string; maxY: string};
  chain: {blockHash: string; blockNumber: string};
};

export type SpaceState = {
  planets: PlanetContractState[];
  space: {x1: number; x2: number; y1: number; y2: number};
  chain: {blockHash: string; blockNumber: string};
};

export class SpaceQueryStore implements QueryStore<SpaceState> {
  private queryStore: QueryStore<SpaceQueryResult>;
  private store: Writable<QueryState<SpaceState>>;
  private unsubscribeFromQuery: () => void | undefined;
  constructor(endpoint: EndPoint) {
    this.queryStore = new HookedQueryStore( // TODO full list
      endpoint,
      `query($first: Int! $lastId: ID! $blockNumber: Int) {
  planets(first: $first where: {id_gt: $lastId} ?$blockNumber?block: {number:$blockNumber}?) {
    id
    owner {
      id
    }
    numSpaceships
    lastUpdated
    exitTime
    active
    reward
  }
  chain(id: "Chain") {
    blockHash
    blockNumber
  }
  space(id: "Space") {
    minX
    maxX
    minY
    maxY
  }
}`,
      chainTempo, // replayTempo, //
      {
        list: {path: 'planets'},
      }
    );

    this.store = writable({step: 'IDLE'}, this.start.bind(this));
  }

  protected start(): () => void {
    this.unsubscribeFromQuery = this.queryStore.subscribe(this.update.bind(this));
    return this.stop.bind(this);
  }

  protected stop(): void {
    if (this.unsubscribeFromQuery) {
      this.unsubscribeFromQuery();
      this.unsubscribeFromQuery = undefined;
    }
  }

  _transform(data?: SpaceQueryResult): SpaceState | undefined {
    if (!data) {
      return undefined;
    }
    return {
      planets: data.planets.map((v) => {
        return {
          id: v.id,
          owner: v.owner ? v.owner.id : undefined,
          numSpaceships: parseInt(v.numSpaceships),
          lastUpdated: parseInt(v.lastUpdated),
          exitTime: parseInt(v.exitTime),
          active: v.active,
          reward: v.reward,
        };
      }),
      space: {
        x1: -parseInt(data.space?.minX || "16"), // TODO sync CONSTANTS with thegraph and contract
        x2: parseInt(data.space?.maxX || "16"),
        y1: -parseInt(data.space?.minY || "16"),
        y2: parseInt(data.space?.maxY || "16"),
      },
      chain: {
        blockHash: data.chain.blockHash,
        blockNumber: data.chain.blockNumber,
      },
    };
  }

  private async update($query: QueryState<SpaceQueryResult>): Promise<void> {
    const transformed = {
      step: $query.step,
      error: $query.error,
      data: this._transform($query.data),
    };
    this.store.set(transformed);
  }

  acknowledgeError(): void {
    return this.queryStore.acknowledgeError();
  }

  subscribe(
    run: Subscriber<QueryState<SpaceState>>,
    invalidate?: Invalidator<QueryState<SpaceState>> | undefined
  ): Unsubscriber {
    return this.store.subscribe(run, invalidate);
  }
}

export const spaceQuery = new SpaceQueryStore(SUBGRAPH_ENDPOINT);
