import {BaseStoreWithData} from '$lib/utils/stores';
import {wallet} from '$lib/stores/wallet';
import {blockTime, finality, logPeriod} from '$lib/config';
import type {BigNumber} from '@ethersproject/bignumber';

export type Departure = {
  amount: number;
  timestamp: number;
  fleet: string;
};

export type FleetSentEvent = {
  args: {
    fleetOwner: string;
    from: BigNumber;
    fleet: BigNumber;
    quantity: number;
    newNumSpaceships: number;
  };
  blockNumber: number;
};

export type ShowPlanetDeparturesFlow = {
  type: 'SHOW_PLANET_DEPARTURE';
  step: 'IDLE' | 'LOADING' | 'READY';
  location?: string;
  departures?: Departure[];
  error?: {message?: string};
};

class MessageFlowStore extends BaseStoreWithData<ShowPlanetDeparturesFlow, undefined> {
  public constructor() {
    super({
      type: 'SHOW_PLANET_DEPARTURE',
      step: 'IDLE',
    });
  }

  async show(location: string): Promise<void> {
    this.setPartial({step: 'LOADING', location});
    try {
      const latestBlock = await wallet.provider.getBlock('latest');
      const toBlock = latestBlock.number - finality;
      const fromBlockNumber = Math.max(0, toBlock - Math.floor(logPeriod / blockTime)) + 1;
      const OuterSpace = wallet.contracts.OuterSpace;
      const filter = OuterSpace.filters.FleetSent(null, location);
      const fleetSentEvents = (((await OuterSpace.queryFilter(
        filter,
        fromBlockNumber,
        toBlock
      )) as unknown) as FleetSentEvent[]).filter(
        (v) => v.args.fleetOwner.toLowerCase() !== wallet.address?.toLowerCase()
      );

      // remove resolved fleets
      for (let i = 0; i < fleetSentEvents.length; i++) {
        const fleetEvent = fleetSentEvents[i];
        const fleetResolved = await  OuterSpace.callStatic.getFleet(fleetEvent.args.fleet, fleetEvent.args.from);
        if (fleetResolved.quantity == 0) {
          fleetSentEvents.splice(i, 1);
          i--;
        }
      }

      let departures: Departure[] = [];
      if (fleetSentEvents.length > 0) {
        const earliestBlock = await wallet.provider.getBlock(fleetSentEvents[0].blockNumber);
        const earliestTime = earliestBlock.timestamp;
        const earliestBlockNumber = earliestBlock.number;
        const averageBlockTime = (latestBlock.timestamp - earliestTime) / (latestBlock.number - earliestBlockNumber);
        departures = fleetSentEvents.map((v) => {
          return {
            timestamp: (v.blockNumber - earliestBlockNumber) * averageBlockTime + earliestTime,
            amount: v.args.quantity,
            fleet: v.args.fleet.toHexString(),
          };
        });
      }

      this.setPartial({
        step: 'READY',
        location,
        departures,
      });
    } catch (e) {
      this.setPartial({error: e});
    }
  }

  async cancel(): Promise<void> {
    this._reset();
  }

  async acknownledgeSuccess(): Promise<void> {
    this._reset();
  }

  async acknownledgeError(): Promise<void> {
    this.setPartial({error: undefined});
  }

  private _reset() {
    this.setPartial({step: 'IDLE', location: undefined});
  }
}

export default new MessageFlowStore();
