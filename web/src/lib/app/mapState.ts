import {PrivateSpace, SpaceInfo, PlanetData} from 'conquest-eth-common';
import {contracts as contractsInfo} from '$lib/app/contractInfos';
import privateAccount from '$lib/stores/privateAccount';
import {fallback, chain} from '$lib/stores/wallet';
import {now} from '$lib/stores/time';
import {SUBGRAPH_ENDPOINT} from '$lib/graphql/graphql_endpoints';

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

type PlanetQueryData = {
  id: string;
  owner: {id: string};
  numSpaceships: string;
  lastUpdated: string;
  exitTime: string;
  active: boolean;
};

type QueryData = {
  planets: PlanetQueryData[];
  space: {
    minX: string;
    maxX: string;
    minY: string;
    maxY: string;
  };
};

async function fetch(
  planetIds: string[]
): Promise<{
  planetStates: PlanetData[];
  discovered: {minX: number; minY: number; maxX: number; maxY: number};
}> {
  // try {
  //   const result = await SUBGRAPH_ENDPOINT.query<
  //     QueryData,
  //     {
  //       planetIds: string[];
  //     }
  //   >({
  //     query: `
  // query($planetIds: [ID!]){
  //   planets(where: {id_in: $planetIds}) {
  //     id
  //     owner {id}
  //     numSpaceships
  //     lastUpdated
  //     exitTime
  //     active
  //   }
  //   space(id: "Space") {
  //     minX
  //     maxX
  //     minY
  //     maxY
  //   }
  // }
  // `,
  //     variables: {planetIds},
  //     context: {
  //       requestPolicy: 'network-only', // required as cache-first will not try to get new data
  //     },
  //   });

  //   if (!result.data) {
  //     throw new Error(`cannot fetch from thegraph node`);
  //   }

  //   const planetsWithState: {
  //     [id: string]: PlanetQueryData;
  //   } = {};
  //   for (const planet of result.data.planets) {
  //     planetsWithState[planet.id] = planet;
  //   }

  //   const planets: PlanetData[] = [];
  //   for (const planetId of planetIds) {
  //     if (!planetsWithState[planetId]) {
  //       console.log('no state', planetId);
  //       planets.push({
  //         id: planetId,
  //         owner: '0x0000000000000000000000000000000000000000',
  //         numSpaceships: 0,
  //         lastUpdated: 0,
  //         active: false,
  //         exitTime: 0,
  //       });
  //     } else {
  //       const planet = planetsWithState[planetId];
  //       planets.push({
  //         id: planet.id,
  //         owner: planet.owner.id,
  //         numSpaceships: parseInt(planet.numSpaceships),
  //         lastUpdated: parseInt(planet.lastUpdated),
  //         active: planet.active,
  //         exitTime: parseInt(planet.exitTime),
  //       });
  //     }
  //   }

  //   const space = result.data.space;

  //   return {
  //     planetStates: planets,
  //     discovered: {
  //       minX: parseInt(space.minX),
  //       minY: parseInt(space.minY),
  //       maxX: parseInt(space.maxX),
  //       maxY: parseInt(space.maxY),
  //     },
  //   };
  // } catch (e) {
  //   console.error(e);
  // }

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
            fleetOwner: string;
            destinationOwner: string;
            won: boolean;
            newNumspaceships: number;
            inFlightFleetLoss: number;
            inFlightPlanetLoss: number;
          };
          return {
            fleetLoss: args.fleetLoss,
            attack: args.fleetOwner != args.destinationOwner,
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
