import {PrivateSpace, SpaceInfo, PlanetData} from '$lib/common/src';
import {contracts as contractsInfo} from '$lib/app/contractInfos';
import privateAccount from '$lib/stores/privateAccount';
import {fallback, chain} from '$lib/stores/wallet';
import {now} from '$lib/stores/time';

const timeKeeper = {
  setTimeout(fn: () => void, sec: number) {
    if (typeof window === 'undefined') {
      // skip on server
      return 0;
    }
    return (setTimeout(fn, sec * 1000) as unknown) as number;
  },
  clearTimeout(t: number) {
    if (typeof window === 'undefined') {
      // skip on server
      return;
    }
    return clearTimeout(t);
  },
  getTime() {
    return now();
  },
};

async function fetch(
  planetIds: string[]
): Promise<{
  planetStates: PlanetData[];
  discovered: {minX: number; minY: number; maxX: number; maxY: number};
}> {
  const contracts = chain.contracts || fallback.contracts;
  if (contracts) {
    return contracts.OuterSpace.getPlanetStates(planetIds);
  } else if (fallback.state === 'Ready') {
    // TODO should indicate fallback is being connected to on the UI ()
    throw new Error('no contracts to fetch with');
  } else {
    console.log('waiting to be connected to a chain...');
  }
  return {planetStates: [], discovered: {minX: 0, minY: 0, maxX: 0, maxY: 0}};
}

export const spaceInfo = new SpaceInfo(contractsInfo.contracts.OuterSpace.linkedData);
export const space = new PrivateSpace(spaceInfo, fetch, timeKeeper, privateAccount);

type FleetPromise = Promise<{
  fleetLoss: number;
  planetLoss: number;
  won: boolean;
  attack: boolean;
  newNumspaceships: number;
  inFlightFleetLoss: number;
  inFlightPlanetLoss: number;
}>;

const fleetPromises: {[fleetId: string]: FleetPromise} = {};

export function fetchFleetEvent(fleetId: string): FleetPromise {
  const contracts = chain.contracts || fallback.contracts;
  if (contracts) {
    const currentPromise = fleetPromises[fleetId];
    if (currentPromise) {
      return currentPromise;
    }

    return (fleetPromises[fleetId] = new Promise((resolve, reject) => {
      (async () => {
        // TODO fix web3w to get access to queryFilter
        const OuterSpace = contracts.OuterSpace?._proxiedContract || contracts.OuterSpace;
        // TODO use blockHash of tx
        const events = await OuterSpace.queryFilter(contracts.OuterSpace.filters.FleetArrived(fleetId));
        const event = events[0];
        if (!event) {
          throw new Error('cannot get corresponding event');
        } else {
          const args = event.args as {
            fleetLoss: number;
            planetLoss: number;
            won: boolean;
            newNumspaceships: number;
            inFlightFleetLoss: number;
            inFlightPlanetLoss: number;
          };
          return {
            fleetLoss: args.fleetLoss,
            attack: args.fleetLoss > 0 || args.planetLoss > 0 || args.won,
            planetLoss: args.planetLoss,
            won: args.won,
            newNumspaceships: args.newNumspaceships,
            inFlightFleetLoss: args.inFlightFleetLoss,
            inFlightPlanetLoss: args.inFlightPlanetLoss,
          };
        }
      })()
        .then(resolve)
        .catch(reject);
    }));
  }
  if (fallback.state === 'Ready') {
    throw new Error('no contracts to fetch with');
  } else {
    throw new Error('not connected');
  }
}
