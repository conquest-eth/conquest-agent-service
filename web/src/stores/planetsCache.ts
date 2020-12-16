import {Readable, Writable, writable} from 'svelte/store';
import {xyToLocation, zonesFromLocation} from 'planet-wars-common';
import {query} from '../_graphql';

const queryString = `
query($zones: [String]) {
  acquiredPlanets(where: {zone_in: $zones}) {
    id
    owner
    numSpaceships
    lastUpdated
  }
}
`;

type AcquiredPlanet = {
  id: string;
  owner: string;
  numSpaceships: string;
  lastUpdated: string;
};

// type QueryRawData = {acquiredPlanets: AcquiredPlanet[]};
type FetchData = AcquiredPlanet[];

const planets: Record<string, AcquiredPlanet> = {};

const zonesLoaded: Record<string, boolean> = {};

const stores: Record<string, Writable<AcquiredPlanet>> = {};
export function planet(location: string): Readable<AcquiredPlanet> {
  // TODO handle case were planet is not in any of the viewing zones: make a fetch
  let store: Writable<AcquiredPlanet> | undefined = stores[location];
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

function setPlanet(location: string, planet: AcquiredPlanet) {
  planets[location] = planet;
  const store = stores[location];
  if (store) {
    store.set(planet);
  }
}

function isZoneLoaded(zone: string): boolean {
  return zonesLoaded[zone];
}

function fetch(zones: string[]): Promise<FetchData> {
  return new Promise<FetchData>((resolve, reject) => {
    query({
      query: queryString,
      variables: {zones},
      context: {
        requestPolicy: 'cache-and-network', // required as cache-first will not try to get new data
      },
    }).subscribe((result) => {
      if (result.error) {
        reject(result.error);
      } else {
        if (result.data) {
          let actualResult: FetchData;
          if (result.data.acquiredPlanets) {
            actualResult = result.data.acquiredPlanets as FetchData;
          } else {
            actualResult = [];
          }
          resolve(actualResult);
        }
      }
    });
  });
}

let lastX: number;
let lastY: number;
let lastCenterZone: string;
let fetchingCounter = 0;
async function update(locationX: number, locationY: number): Promise<void> {
  if (locationX !== lastX || locationY !== lastY) {
    lastX = locationX;
    lastY = locationY;
    const zones = zonesFromLocation(locationX, locationY);
    if (lastCenterZone !== zones[0]) {
      lastCenterZone = zones[0];
      fetchingCounter++;
      startFetching(fetchingCounter, zones);
    }
  }
}

async function startFetching(fetchingCounterOnFetch: number, zones: string[]) {
  const freshPlanets = await fetch(zones);
  if (fetchingCounterOnFetch !== fetchingCounter) {
    return; // discard pending ? // TODO more complex (blockNumber?)
  }
  const queryTime = Math.floor(Date.now() / 1000); // TODO use latest block number for queries
  for (const zone of zones) {
    zonesLoaded[zone] = true; // TODO different state : stale, etc... or use queryTime
  }
  for (const freshPlanet of freshPlanets) {
    const location = freshPlanet.id;
    const planet = {...freshPlanet, queryTime};
    setPlanet(location, planet);
  }
  setTimeout(() => startFetching(fetchingCounterOnFetch, zones), 3000); //TODO config delay
}

function getPlanet(x: number, y: number): AcquiredPlanet {
  return planets[xyToLocation(x, y)];
}

export const cache = {
  getPlanet,
  isZoneLoaded,
  update,
};
