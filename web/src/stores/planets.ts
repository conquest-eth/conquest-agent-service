import { locationToXY, Planet, xyToLocation } from 'planet-wars-common';
import {Readable, Writable, writable} from 'svelte/store';
import {space} from '../app/mapState';

const stores: Record<string, Writable<Planet>> = {};
export function planetAt(location: string): Readable<Planet> {
  if (!location) {
    throw new Error(`invalid location ${location}`);
  }
  let store: Writable<Planet> | undefined = stores[location];
  if (!store) {
    const xy = locationToXY(location);
    store = writable(space.ensurePlanetAt(xy.x, xy.y), (set) => {
      stores[location] = store;
      const listenerIndex = space.onPlannetUpdates(location, (planet: Planet) => {
        set(planet);
      })
      return () => {
        space.switchOffPlanetUpdates(listenerIndex);
        delete stores[location];
      };
    });
  }
  return store;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
if (typeof window !== 'undefined') {
  (window as any).planets = {planetAt, xyToLocation};
}
/* eslint-enable @typescript-eslint/no-explicit-any */
