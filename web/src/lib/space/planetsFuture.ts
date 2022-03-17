import type {PlanetInfo, PlanetState} from 'conquest-eth-common';
import {derived} from 'svelte/store';
import type {Readable} from 'svelte/store';
import {planets} from './planets';
import type {Fleet} from './fleets';
import {fleetList} from './fleets';
import {spaceInfo} from './spaceInfo';
import {now} from '$lib/time';
import {playersQuery} from './playersQuery';

export type PlanetFutureState = {state: PlanetState; fleet: Fleet}[];

class PlanetFutureStateStores {
  private stores: Record<string, Readable<PlanetFutureState>> = {};

  futureStatesFor(planetInfo: PlanetInfo): Readable<PlanetFutureState> {
    const id = planetInfo.location.id;
    let store: Readable<PlanetFutureState> | undefined = this.stores[id];
    if (!store) {
      const planetState = planets.planetStateFor(planetInfo);
      store = derived([planetState, fleetList], ([$planetState, $fleetList]) => {
        const fleets = $fleetList.fleets.filter((v) => v.to.location.id === planetInfo.location.id);
        const futures = [];
        let futureState = $planetState;

        const currentTime = now();
        let lastArrivalTimeWanted = 0;
        let lastTime = currentTime;
        for (const fleet of fleets) {
          if (fleet.arrivalTimeWanted > 0) {
            if (lastArrivalTimeWanted === fleet.arrivalTimeWanted) {
            }
            lastArrivalTimeWanted = fleet.arrivalTimeWanted;
          }

          const expectedArrivalTime = fleet.timeLeft + currentTime;
          const extraTime = expectedArrivalTime - lastTime;
          lastTime = expectedArrivalTime;

          if (extraTime > 0) {
            futureState = spaceInfo.computeFuturePlanetState(planetInfo, futureState, extraTime);
          }
          const outcome = spaceInfo.outcome(
            fleet.from,
            planetInfo,
            $planetState,
            fleet.quantity,
            fleet.timeLeft,
            playersQuery.getPlayer(fleet.fleetSender),
            playersQuery.getPlayer(fleet.owner),
            playersQuery.getPlayer($planetState.owner),
            fleet.gift,
            fleet.specific
          );
          if (outcome.gift) {
            futureState.numSpaceships = outcome.min.numSpaceshipsLeft;
          } else {
            futureState.numSpaceships = outcome.min.numSpaceshipsLeft;
            if (outcome.min.captured) {
              futureState.owner = fleet.owner;
            }
          }
          // TODO accumulated

          if (extraTime > 0) {
            futures.push({
              state: futureState,
              fleet,
            });
          }
        }
        return futures;
      });
    }
    return store;
  }
}

export const planetFutureStates = new PlanetFutureStateStores();
