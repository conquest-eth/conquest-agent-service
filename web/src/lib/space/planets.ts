import type {PlanetInfo, PlanetState} from 'conquest-eth-common';
import {Readable, Writable, writable} from 'svelte/store';
import {planetStates} from './planetStates';

class PLanetStateStores {
  private stores: Record<string, Writable<PlanetState>> = {};

  planetStateFor(planetInfo: PlanetInfo): Readable<PlanetState> {
    const id = planetInfo.location.id;
    let store: Writable<PlanetState> | undefined = this.stores[id];
    if (!store) {
      store = writable(undefined, (set) => {
        this.stores[id] = store as Writable<PlanetState>;
        const listenerIndex = planetStates.onPlannetUpdates(planetInfo, (planet: PlanetState) => {
          set(planet);
        });
        return () => {
          planetStates.switchOffPlanetUpdates(listenerIndex);
          // delete this.stores[id]; // TODO ?
        };
      });
    }
    return store;
  }
}

export const planets = new PLanetStateStores();
