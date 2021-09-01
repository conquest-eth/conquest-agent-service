import type {Invalidator, Subscriber, Unsubscriber} from 'web3w/dist/esm/utils/internals';
import {SUBGRAPH_ENDPOINT} from '$lib/blockchain/subgraph';
import type {QueryState, QueryStore, QueryStoreWithRuntimeVariables} from '$lib/utils/stores/graphql';
import {HookedQueryStore} from '$lib/utils/stores/graphql';
import type {EndPoint} from '$lib/utils/graphql/endpoint';
import {chainTempo} from '$lib/blockchain/chainTempo';
import type { Writable } from 'svelte/store';
import { writable } from 'svelte/store';
import type {AccountState} from '$lib/account/account';
import { account } from '$lib/account/account';
import type { FleetArrivedEvent } from './subgraphTypes';

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

export type FleetArrived = FleetArrivedEvent; // TODO ?

export type SpaceQueryResult = {
  planets: PlanetQueryState[];
  space?: {minX: string; maxX: string; minY: string; maxY: string};
  chain: {blockHash: string; blockNumber: string};
  fleetsArrivedFromYou:FleetArrivedEvent[]; // TODO
  fleetsArrivedToYou: FleetArrivedEvent[]; // TODO
};

export type SpaceState = {
  planets: PlanetContractState[];
  loading: boolean;
  space: {x1: number; x2: number; y1: number; y2: number};
  chain: {blockHash: string; blockNumber: string};
  fleetsArrivedFromYou: FleetArrived[]; // TODO
  fleetsArrivedToYou: FleetArrived[]; // TODO
};


// TODO fleetArrivedEvents need to be capped from 7 days / latest acknowledged block number
export class SpaceQueryStore implements QueryStore<SpaceState> {
  private queryStore: QueryStoreWithRuntimeVariables<SpaceQueryResult>;
  private store: Writable<QueryState<SpaceState>>;
  private unsubscribeFromQuery: () => void | undefined;
  private stopAccountSubscription: (() => void) | undefined = undefined;
  /*
`query($first: Int! $lastId: ID! $blockNumber: Int $owner: String) {
  planets(first: $first where: {id_gt: $lastId} ?$blockNumber?block: {number:$blockNumber}?) {
  */
  constructor(endpoint: EndPoint) {
    this.queryStore = new HookedQueryStore( // TODO full list
      endpoint,
      `query($first: Int! $lastId: ID! $owner: String) {
  planets(first: $first where: {id_gt: $lastId}) {
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
  ?$owner?
  fleetsArrivedFromYou: fleetArrivedEvents(where: {owner: $owner destinationOwner_not: $owner}) {
    id
    blockNumber
    timestamp
    transaction {id}
    owner {id}
    planet {id}
    fleet {id}
    destinationOwner {id}
    fleetLoss
    planetLoss
    inFlightFleetLoss
    inFlightPlanetLoss
    won
    newNumspaceships
    from {id}
    quantity
  }

  fleetsArrivedToYou: fleetArrivedEvents(where: {destinationOwner: $owner owner_not: $owner}) {
    id
    blockNumber
    timestamp
    transaction {id}
    owner {id}
    planet {id}
    fleet {id}
    destinationOwner {id}
    fleetLoss
    planetLoss
    inFlightFleetLoss
    inFlightPlanetLoss
    won
    newNumspaceships
    from {id}
    quantity
  }
  ?
}`,
      chainTempo, // replayTempo, //
      {
        list: {path: 'planets'},
      }
    );

    this.store = writable({step: 'IDLE'}, this.start.bind(this));
  }

  protected start(): () => void {
    this.stopAccountSubscription = account.subscribe(async ($account) => {
      await this._handleAccountChange($account);
    });
    this.unsubscribeFromQuery = this.queryStore.subscribe(this.update.bind(this));
    return this.stop.bind(this);
  }

  protected stop(): void {
    if (this.stopAccountSubscription) {
      this.stopAccountSubscription();
      this.stopAccountSubscription = undefined;
    }
    if (this.unsubscribeFromQuery) {
      this.unsubscribeFromQuery();
      this.unsubscribeFromQuery = undefined;
    }
  }

  private async _handleAccountChange($account: AccountState): Promise<void> {
    const accountAddress = $account.ownerAddress?.toLowerCase();
    if (this.queryStore.runtimeVariables.owner !== accountAddress) {
      this.queryStore.runtimeVariables.owner = accountAddress;
      this.store.update(v => {if (v.data) {v.data.loading = true;} return v;} );
      this.queryStore.fetch({blockNumber: chainTempo.chainInfo.lastBlockNumber});
    }
    // TODO
    // delete other account data in sync
    // by the way, planet can be considered loading if the blockHash their state is taken from is different than latest query blockHash
    // this means we have to keep track of each planet query's blockHash
    // then a global loading flag could be set based on whether there is at least one planet loading, or account changed
  }

  _transform(data?: SpaceQueryResult): SpaceState | undefined {
    if (!data) {
      return undefined;
    }
    return {
      loading: false,
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
      fleetsArrivedFromYou: !data.fleetsArrivedFromYou ? [] :data.fleetsArrivedFromYou.map(v => {
        return v; // TODO ?
      }),
      fleetsArrivedToYou: !data.fleetsArrivedToYou? [] : data.fleetsArrivedToYou.map(v => {
        return v; // TODO ?
      })
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
