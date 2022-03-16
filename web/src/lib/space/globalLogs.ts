import {BaseStoreWithData} from '$lib/utils/stores/base';
import {blockTime, finality, logPeriod, lowFrequencyFetch} from '$lib/config';
import {SUBGRAPH_ENDPOINT} from '$lib/blockchain/subgraph';
import type {GenericEvent, GenericParsedEvent} from './subgraphTypes';
import {parseEvent} from './subgraphTypes';

export type GlobalLogs = {
  step: 'IDLE' | 'LOADING' | 'READY';
  data?: GenericParsedEvent[];
  error?: string;
};

type QueryData = {
  ownerEvents: GenericEvent[];
};

// TODO __typename_not_in: [""]
//  __typename cannot be used for that. should maybe add a manual typename
const eventsToFilterOut = ['TravelingUpkeepReductionFromDestructionEvent', 'StakeToWithdrawEvent', 'ExitCompleteEvent'];

class GlobalLogsStore extends BaseStoreWithData<GlobalLogs, GenericParsedEvent[]> {
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
      ownerEvents(
        orderDirection: desc
        orderBy: blockNumber
        where: {
          timestamp_gt: $timestamp
          # TODO : __typename_not_in: [""]
        }
        first: 1000
      ) {
    id
    __typename
    transaction {id}
    timestamp
    owner {id}
    ... on  PlanetEvent{
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
      fleet {id}
      destinationOwner {id}
      gift
      fleetLoss
      planetLoss
      inFlightFleetLoss
      inFlightPlanetLoss
      won
      newNumspaceships
      newTravelingUpkeep
      newOverflow
      accumulatedDefenseAdded
      accumulatedAttackAdded
      from {id}
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
      >(query, {
        variables: {timestamp},
        context: {
          requestPolicy: 'network-only', // required as cache-first will not try to get new data
        },
      });

      if (!result.data) {
        console.error(result);
        this.setPartial({error: `cannot fetch from thegraph node`});
        throw new Error(`cannot fetch from thegraph node`);
      }

      const events = result.data.ownerEvents
        .filter((v) => eventsToFilterOut.indexOf(v.__typename) === -1)
        .map(parseEvent);

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
