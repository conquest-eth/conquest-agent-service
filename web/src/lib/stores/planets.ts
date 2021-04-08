import {locationToXY} from '$lib/common/src';
import type {Planet} from '$lib/common/src/types';
import {Readable, Writable, writable} from 'svelte/store';
import {space} from '$lib/app/mapState';

const stores: Record<string, Writable<Planet>> = {};
export function planetAt(location: string): Readable<Planet> {
  if (!location) {
    throw new Error(`invalid location ${location}`);
  }
  let store: Writable<Planet> | undefined = stores[location];
  if (!store) {
    const xy = locationToXY(location);
    store = writable(space.ensurePlanetAt(xy.x, xy.y), (set) => {
      stores[location] = store as Writable<Planet>;
      const listenerIndex = space.onPlannetUpdates(location, (planet: Planet) => {
        set(planet);
      });
      return () => {
        space.switchOffPlanetUpdates(listenerIndex);
        delete stores[location];
      };
    });
  }
  return store;
}
