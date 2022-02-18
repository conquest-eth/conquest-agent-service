import type {Invalidator, Subscriber, Unsubscriber} from 'web3w/dist/esm/utils/internals';
import {SUBGRAPH_ENDPOINT} from '$lib/blockchain/subgraph';
import type {QueryState, QueryStore, QueryStoreWithRuntimeVariables} from '$lib/utils/stores/graphql';
import {HookedQueryStore} from '$lib/utils/stores/graphql';
import type {EndPoint} from '$lib/utils/graphql/endpoint';
import {chainTempo} from '$lib/blockchain/chainTempo';
import type {Writable} from 'svelte/store';
import {writable} from 'svelte/store';
import type {AccountState} from '$lib/account/account';
import {account} from '$lib/account/account';
import type {
  FleetArrivedEvent,
  PlanetExitEvent,
  PlanetInteruptedExitEvent,
  planetTimePassedExitEvent,
} from './subgraphTypes';
import {deletionDelay, blockTime} from '$lib/config';
import {now} from '$lib/time';
import {BigNumber} from '@ethersproject/bignumber';
import {spaceInfo} from './spaceInfo';

const blockRange = Math.floor(deletionDelay / blockTime);
const timeRange = deletionDelay;

export type PlanetQueryState = {
  id: string;
  owner: {id: string};
  numSpaceships: string;
  travelingUpkeep: string;
  overflow: string;
  lastUpdated: string;
  exitTime: string;
  active: boolean;
  rewardGiver: string;
};

export type PlanetContractState = {
  id: string;
  owner: string;
  numSpaceships: number;
  travelingUpkeep: number;
  overflow: number;
  lastUpdated: number;
  exitTime: number;
  active: boolean;
  rewardGiver: string;
};

export type OwnerParsedEvent = {
  transaction: {id: string};
  owner: {id: string};
  timestamp: number;
  blockNumber: number;
};

export type GenericParsedEvent =
  | PlanetStakeParsedEvent
  | PlanetExitParsedEvent
  | FleetArrivedParsedEvent
  | FleetSentParsedEvent
  | PlanetExitParsedEvent;

export type PlanetParsedEvent = OwnerParsedEvent & {
  __typename: 'PlanetStakeEvent' | 'PlanetExitEvent' | 'FleetSentEvent' | 'FleetArrivedEvent';
  planet: {id: string};
};

export type PlanetStakeParsedEvent = PlanetParsedEvent & {
  __typename: 'PlanetStakeEvent';
  numSpaceships: string;
  stake: string;
};

export type PlanetExitParsedEvent = PlanetParsedEvent & {
  __typename: 'PlanetExitEvent';
  exitTime: number;
  stake: BigNumber;
  interupted: boolean;
  complete: boolean;
  success: boolean;
};

export type PlanetInteruptedExitParsedEvent = PlanetExitParsedEvent & {
  interupted: true;
};
export type planetTimePassedExitParsedEvent = PlanetExitParsedEvent & {
  interupted: false;
};

export type FleetArrivedParsedEvent = PlanetParsedEvent & {
  __typename: 'FleetArrivedEvent';
  fleetLoss: number;
  planetLoss: number;
  inFlightFleetLoss: number;
  inFlightPlanetLoss: number;
  destinationOwner: {id: string};
  gift: boolean;
  fleet: {id: string};
  from: {id: string};
  won: boolean;
  quantity: number;
  planet: {id: string};
  newNumspaceships: number;
};

export type FleetSentParsedEvent = PlanetParsedEvent & {
  __typename: 'FleetSentEvent';
  fleet: {id: string};
  quantity: number;
};

export type SpaceQueryResult = {
  otherplanets: PlanetQueryState[];
  myplanets?: PlanetQueryState[];
  owner?: {id: string};
  space?: {minX: string; maxX: string; minY: string; maxY: string};
  chain?: {blockHash: string; blockNumber: string};
  fleetsArrivedFromYou?: FleetArrivedEvent[]; // TODO
  fleetsArrivedToYou?: FleetArrivedEvent[]; // TODO
  planetInteruptedExitEvents?: PlanetInteruptedExitEvent[];
  planetTimePassedExitEvents?: planetTimePassedExitEvent[];
};

export type SpaceState = {
  player: string;
  planets: PlanetContractState[];
  loading: boolean;
  space: {x1: number; x2: number; y1: number; y2: number};
  chain: {blockHash: string; blockNumber: string};
  fleetsArrivedFromYou: FleetArrivedParsedEvent[]; // TODO
  fleetsArrivedToYou: FleetArrivedParsedEvent[]; // TODO
  planetInteruptedExitEvents?: PlanetInteruptedExitParsedEvent[];
  planetTimePassedExitEvents?: planetTimePassedExitParsedEvent[];
};

function parseFleetArrived(v: FleetArrivedEvent): FleetArrivedParsedEvent {
  return {
    __typename: v.__typename,
    transaction: v.transaction,
    owner: v.owner,
    timestamp: parseInt(v.timestamp),
    blockNumber: v.blockNumber,
    planet: v.planet,
    fleetLoss: parseInt(v.fleetLoss),
    planetLoss: parseInt(v.planetLoss),
    inFlightFleetLoss: parseInt(v.inFlightFleetLoss),
    inFlightPlanetLoss: parseInt(v.inFlightPlanetLoss),
    destinationOwner: v.destinationOwner,
    gift: v.gift,
    fleet: v.fleet,
    from: v.from,
    won: v.won,
    quantity: parseInt(v.quantity),
    newNumspaceships: parseInt(v.newNumspaceships),
  };
}

function parsePlanetExitEvent(v: PlanetExitEvent, interupted: boolean): PlanetExitParsedEvent {
  return {
    __typename: v.__typename,
    transaction: v.transaction,
    owner: v.owner,
    timestamp: parseInt(v.timestamp),
    blockNumber: v.blockNumber,
    planet: v.planet,
    stake: BigNumber.from(v.stake),
    exitTime: parseInt(v.exitTime),
    complete: v.complete,
    interupted, // : v.interupted,
    success: v.success,
  };
}

function parsePlanetInteruptedExitEvent(v: PlanetExitEvent): PlanetInteruptedExitParsedEvent {
  return parsePlanetExitEvent(v, true) as PlanetInteruptedExitParsedEvent;
}

function parseplanetTimePassedExitEvent(v: PlanetExitEvent): planetTimePassedExitParsedEvent {
  return parsePlanetExitEvent(v, false) as planetTimePassedExitParsedEvent;
}

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
      `query($first: Int! $lastId: ID! $owner: String $fromTime: Int! $exitTimeEnd: Int!) {
  otherplanets: planets(first: $first where: {id_gt: $lastId ?$owner?owner_not: $owner?}) {
    id
    owner {
      id
    }
    numSpaceships
    travelingUpkeep
    overflow
    lastUpdated
    exitTime
    active
    rewardGiver
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
  owner(id: $owner) {id}
  myplanets: planets(first: 1000 where: {owner: $owner}) {
    id
    owner {
      id
    }
    numSpaceships
    travelingUpkeep
    overflow
    lastUpdated
    exitTime
    active
    rewardGiver
  }
  planetInteruptedExitEvents: planetExitEvents(where: {owner: $owner exitTime_gt: $fromTime interupted: true} orderBy: timestamp, orderDirection: desc) {
    planet {id}
    exitTime
    stake
    interupted
    complete
    success
  }
  planetTimePassedExitEvents: planetExitEvents(where: {owner: $owner exitTime_gt: $fromTime exitTime_lt: $exitTimeEnd} orderBy: timestamp, orderDirection: desc) {
    planet {id}
    exitTime
    stake
    interupted
    complete
    success
  }
  fleetsArrivedFromYou: fleetArrivedEvents(where: {owner: $owner timestamp_gt: $fromTime} orderBy: timestamp, orderDirection: desc) {
    id
    blockNumber
    timestamp
    transaction {id}
    owner {id}
    planet {id}
    fleet {id}
    destinationOwner {id}
    gift
    fleetLoss
    planetLoss
    inFlightFleetLoss
    inFlightPlanetLoss
    won
    newNumspaceships
    from {id}
    quantity
  }

  fleetsArrivedToYou: fleetArrivedEvents(where: {destinationOwner: $owner owner_not: $owner timestamp_gt: $fromTime} orderBy: timestamp, orderDirection: desc) {
    id
    blockNumber
    timestamp
    transaction {id}
    owner {id}
    planet {id}
    fleet {id}
    destinationOwner {id}
    gift
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
        list: {path: 'otherplanets'},
        variables: {
          first: 500,
        },
        prefetchCallback: (variables) => {
          // if (variables.blockNumber && typeof variables.blockNumber === 'number') {
          //   variables.fromBlock = Math.max(0, variables.blockNumber - blockRange);
          // }
          variables.exitTimeEnd = Math.floor(Math.max(0, now() - spaceInfo.exitDuration));
          variables.fromTime = Math.floor(Math.max(0, now() - timeRange));
        },
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
      this.store.update((v) => {
        if (v.data) {
          v.data.loading = true;
        }
        return v;
      });
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

    const planets = (data.myplanets || []).concat(data.otherplanets);
    return {
      loading: false,
      player: data.owner?.id,
      planets: planets.map((v) => {
        return {
          id: v.id,
          owner: v.owner ? v.owner.id : undefined,
          numSpaceships: parseInt(v.numSpaceships),
          travelingUpkeep: parseInt(v.travelingUpkeep),
          overflow: parseInt(v.overflow),
          lastUpdated: parseInt(v.lastUpdated),
          exitTime: parseInt(v.exitTime),
          active: v.active,
          rewardGiver: v.rewardGiver,
        };
      }),
      space: {
        x1: -parseInt(data.space?.minX || '16'), // TODO sync CONSTANTS with thegraph and contract
        x2: parseInt(data.space?.maxX || '16'),
        y1: -parseInt(data.space?.minY || '16'),
        y2: parseInt(data.space?.maxY || '16'),
      },
      chain: {
        blockHash: data.chain.blockHash,
        blockNumber: data.chain.blockNumber,
      },
      fleetsArrivedFromYou: !data.fleetsArrivedFromYou ? [] : data.fleetsArrivedFromYou.map(parseFleetArrived),
      fleetsArrivedToYou: !data.fleetsArrivedToYou ? [] : data.fleetsArrivedToYou.map(parseFleetArrived),
      planetInteruptedExitEvents: !data.planetInteruptedExitEvents
        ? []
        : data.planetInteruptedExitEvents.map(parsePlanetInteruptedExitEvent),
      planetTimePassedExitEvents: !data.planetTimePassedExitEvents
        ? []
        : data.planetTimePassedExitEvents.map(parseplanetTimePassedExitEvent),
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
