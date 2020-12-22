import {Readable, Writable, writable} from 'svelte/store';
import {PlanetUpdatableData, xyToLocation, areasArroundLocation} from 'planet-wars-common';
import {spaceInfo} from '../app/mapState';
import {fallback, chain} from '../stores/wallet';

type PlanetData = PlanetUpdatableData & {id: string};

const planets: Record<string, PlanetUpdatableData> = {};

const stores: Record<string, Writable<PlanetUpdatableData>> = {};
export function planet(location: string): Readable<PlanetUpdatableData> {
  // TODO handle case were planet is not in any of the viewing areas: make a fetch
  let store: Writable<PlanetUpdatableData> | undefined = stores[location];
  if (!store) {
    store = writable(planets[location], (set) => {
      stores[location] = store;
      set(planets[location]);
      return () => {
        delete stores[location];
      };
    });
  }
  return store;
}

function setPlanet(location: string, planet: PlanetUpdatableData) {
  planets[location] = planet;
  const store = stores[location];
  if (store) {
    store.set(planet);
  }
}

async function fetch(planetIds: string[]): Promise<PlanetData[]> {
  const contracts = chain.contracts || fallback.contracts;
  if (contracts) {
    return contracts.OuterSpace.getPlanetStates(planetIds);
    // const result = await contracts.OuterSpace.functions.getPlanetStates(planetIds);
    // return result[0];
  } else if (fallback.state === 'Ready') { // TODO should indicate fallback is being connected to on the UI ()
    throw new Error('no contracts to fetch with');
  } else {
    console.log('not ready');
  }
  return [];
}

let lastX: number;
let lastY: number;
let lastCenterArea: string;
let fetchingCounter = 0;
// async function update(locationX: number, locationY: number): Promise<void> {
//   if (locationX !== lastX || locationY !== lastY) {
//     lastX = locationX;
//     lastY = locationY;
//     const centerArea = areaFromLocation(locationX, locationY);
//     console.log({centerArea});
//     const planetIds = spaceInfo.planetIdsArroundLocation(locationX, locationY);
//     if (lastCenterArea !== centerArea) {
//       lastCenterArea = centerArea;
//       fetchingCounter++;
//       startFetching(fetchingCounter, planetIds);
//     }
//   }
// }

// async function startFetching(fetchingCounterOnFetch: number, planetIds: string[]) {
//   let freshPlanets
//   try {
//     console.log({planetIds}),
//     freshPlanets = await fetch(planetIds);
//   } catch(e) {
//     console.error(e);
//   }
//   if (fetchingCounterOnFetch !== fetchingCounter) {
//     return; // discard pending ? // TODO more complex (blockNumber?)
//   }
//   console.log({freshPlanets});
//   if (freshPlanets) {
//     const queryTime = Math.floor(Date.now() / 1000); // TODO use latest block number for queries
//     for (const freshPlanet of freshPlanets) {
//       const location = freshPlanet.id;
//       const planet = {...freshPlanet, queryTime};
//       setPlanet(location, planet);
//     }
//   }
//   setTimeout(() => startFetching(fetchingCounterOnFetch, planetIds), 3000); //TODO config delay
// }

async function update(locationX: number, locationY: number): Promise<void> {
  if (locationX !== lastX || locationY !== lastY) {
    lastX = locationX;
    lastY = locationY;
    const areas = areasArroundLocation(locationX, locationY);
    const centerArea = areas[0];
    if (lastCenterArea !== centerArea) {
      lastCenterArea = centerArea;
      fetchingCounter++;
      startFetching(fetchingCounter, areas);
    }
  }
}

// async function startFetching(fetchingCounterOnFetch: number, areas: string[]) {
//   let freshPlanets = [];
//   for (const area of areas) {
//     try {
//       const planetIds = spaceInfo.planetIdsFromArea(area);
//       console.log({planetIds});
//       const planets = await fetch(planetIds);
//       for (let i = 0; i < planetIds.length; i++) {
//         const planet = planets[i];
//         freshPlanets.push({id : planetIds[i], owner: planet.owner, exitTime: planet.exitTime, numSpaceships: planet.numSpaceships, lastUpdated: planet.lastUpdated, active: planet.active})
//       }
//       freshPlanets = freshPlanets.concat(planets);
//       console.log({planets});
//     } catch(e) {
//       console.error(e);
//     }
//     if (fetchingCounterOnFetch !== fetchingCounter) {
//       return; // discard pending ? // TODO more complex (blockNumber?)
//     }
//   }
//   const queryTime = Math.floor(Date.now() / 1000); // TODO use latest block number for queries
//   for (const freshPlanet of freshPlanets) {
//     const location = freshPlanet.id;
//     const planet = {...freshPlanet, queryTime};
//     setPlanet(location, planet);
//   }
//   setTimeout(() => startFetching(fetchingCounterOnFetch, areas), 3000); //TODO config delay
// }

async function startFetching(fetchingCounterOnFetch: number, areas: string[]) {
  for (const area of areas) {
    try {
      const planetIds = await spaceInfo.asyncPlanetIdsFromArea(area);
      // console.log({planetIds});
      const planets = await fetch(planetIds);
      if (fetchingCounterOnFetch !== fetchingCounter) {
        return; // discard pending ? // TODO more complex (blockNumber?)
      }
      for (let i = 0; i < planets.length; i++) {
        const planet = planets[i];
        if (!planet.owner) {
          console.error(`missing owner for ${planetIds[i]}`)
        }
        // const queryTime = Math.floor(Date.now() / 1000); // TODO use latest block number for queries
        setPlanet(planetIds[i], {
          owner: planet.owner,
          exitTime: planet.exitTime,
          numSpaceships: planet.numSpaceships,
          lastUpdated: planet.lastUpdated,
          active: planet.active,
          // queryTime // TODO ?
        });
      }
    } catch(e) {
      console.error(e);
    }
  }

  setTimeout(() => startFetching(fetchingCounterOnFetch, areas), 3000); //TODO config delay
}

function getPlanet(x: number, y: number): PlanetUpdatableData {
  return planets[xyToLocation(x, y)];
}

export const cache = {
  getPlanet,
  update,
};
