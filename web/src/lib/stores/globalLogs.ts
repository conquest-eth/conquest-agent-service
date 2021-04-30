import {BaseStoreWithData} from '$lib/utils/stores';
import {blockTime, finality, logPeriod, lowFrequencyFetch} from '$lib/config';
import {SUBGRAPH_ENDPOINT} from '$lib/graphql/graphql_endpoints';

export type OwnerEvent = {
  transactionID: string;
  owner: {id: string};
  timestamp: string;
};

export type GenericEvent = PlanetStakeEvent | PlanetExitEvent | FleetArrivedEvent | FleetSentEvent; // | ExitCompleteEvent ?

export type OwnedPlanetEvent = OwnerEvent & {
  __typename: 'PlanetStakeEvent' | 'PlanetExitEvent' | 'FleetSentEvent' | 'FleetArrivedEvent';
  planet: {id: string};
};

export type PlanetStakeEvent = OwnedPlanetEvent & {
  __typename: 'PlanetStakeEvent';
  numSpaceships: string;
  stake: string;
};

export type PlanetExitEvent = OwnedPlanetEvent & {
  __typename: 'PlanetExitEvent';
  exitTime: string;
  stake: string;
};

export type FleetArrivedEvent = OwnedPlanetEvent & {
  __typename: 'FleetArrivedEvent';
  fleetLoss: string;
  planetLoss: string;
  inFlightFleetLoss: string;
  inFlightPlanetLoss: string;
  destinationOwner: {id: string};
  fleet: {id: string};
  from: {id: string};
  won: boolean;
  quantity: string;
};

export type FleetSentEvent = OwnedPlanetEvent & {
  __typename: 'FleetSentEvent';
  fleet: {id: string};
  quantity: string;
};

export type GlobalLogs = {
  step: 'IDLE' | 'LOADING' | 'READY';
  data?: GenericEvent[];
  error?: string;
};

type QueryData = {
  ownerEvents: GenericEvent[];
};

class GlobalLogsStore extends BaseStoreWithData<GlobalLogs, GenericEvent[]> {
  private timeout: NodeJS.Timeout;
  public constructor() {
    super({
      step: 'IDLE',
    });
  }

  async fetch() {
    const timestamp = '0'; // TODO

    const query = `
    query($timestamp: BigInt!){
ownerEvents(orderDirection: desc orderBy: blockNumber where: {timestamp_gt: $timestamp} first: 1000) {
  id
   __typename
   transactionID
   timestamp
   owner {id}
   ... on  OwnedPlanetEvent{
      planet {id}
    }
   ... on PlanetStakeEvent{
    numSpaceships
    stake
   }
   ... on PlanetExitEvent{
      exitTime
      stake
   }
   ... on  FleetArrivedEvent{
      fleetLoss
      planetLoss
      inFlightFleetLoss
      inFlightPlanetLoss
      destinationOwner{id}
      fleet{id}
      from{id}
      won
      quantity
    }
   ... on FleetSentEvent{
      fleet{id}
      quantity
   }
}
}

`;

    try {
      const result = await SUBGRAPH_ENDPOINT.query<
        QueryData,
        {
          timestamp: string;
        }
      >({
        query,
        variables: {timestamp},
        context: {
          requestPolicy: 'network-only', // required as cache-first will not try to get new data
        },
      });

      if (!result.data) {
        this.setPartial({error: `cannot fetch from thegraph node`});
        throw new Error(`cannot fetch from thegraph node`);
      }

      const events = result.data.ownerEvents;

      this.setPartial({data: events});

      this.setPartial({step: 'READY'});
      // TODO
    } catch (e) {
      console.error(e);
    }

    this.timeout = setTimeout(this.fetch.bind(this), lowFrequencyFetch * 1000);
  }

  start() {
    if (this.$store.step === 'IDLE') {
      this.setPartial({step: 'LOADING'});
    }
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.timeout = setTimeout(this.fetch.bind(this), 1000);
  }

  stop() {
    this.setPartial({step: 'IDLE'});
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
  }
}

export const globalLogs = new GlobalLogsStore();
