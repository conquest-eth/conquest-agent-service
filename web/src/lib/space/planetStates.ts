import {now, time} from '$lib/time';
import type {QueryState} from '$lib/utils/stores/graphql';
import type {PlanetInfo, PlanetState} from 'conquest-eth-common';
import {spaceInfo} from './spaceInfo';
import {spaceQuery, SpaceState} from './spaceQuery';

export class PlanetStates {
  private planetListeners: Record<string, number[] | undefined> = {};
  private listenerIndex = 0;
  private listeners: Record<number, {planetInfo: PlanetInfo; func: (planetState: PlanetState) => void}> = {};

  private spaceStateCache: SpaceState;

  start(): void {
    spaceQuery.subscribe(this.onQueryResult.bind(this));
    time.subscribe(this.onTime.bind(this));
  }

  private onTime() {
    if (this.spaceStateCache) {
      this.processSpace(this.spaceStateCache, now());
    }
  }

  onPlannetUpdates(planetInfo: PlanetInfo, func: (planetState: PlanetState) => void): number {
    this.listenerIndex++;
    this.listeners[this.listenerIndex] = {planetInfo, func};
    let currentListeners = this.planetListeners[planetInfo.location.id];
    if (!currentListeners) {
      currentListeners = [];
    }
    currentListeners.push(this.listenerIndex);
    this.planetListeners[planetInfo.location.id] = currentListeners;

    if (this.spaceStateCache) {
      const planetStates = this._transform(this.spaceStateCache, now());
      for (const planet of planetStates) {
        if (planet.id === planetInfo.location.id) {
          func(planet.state);
        }
      }
    }

    return this.listenerIndex;
  }

  switchOffPlanetUpdates(listenerIndex: number): void {
    delete this.listeners[listenerIndex];
  }

  onQueryResult(space: QueryState<SpaceState>): void {
    if (!space.data) {
      // TODO error
      return;
    }
    this.spaceStateCache = space.data;
    this.processSpace(space.data, now());
  }

  processSpace(space: SpaceState, time: number): void {
    const planetStates = this._transform(space, time);
    for (const planet of planetStates) {
      this._callListeners(planet.id, planet.state);
    }
  }

  _transform(space: SpaceState, time: number): {state: PlanetState; id: string}[] {
    const planets: {state: PlanetState; id: string}[] = [];
    for (const planet of space.planets) {
      const planetInfo = spaceInfo.getPlanetInfoViaId(planet.id);
      if (!planetInfo) {
        continue;
      }
      const inReach =
        planetInfo.location.x >= space.space.x1 &&
        planetInfo.location.x <= space.space.x2 &&
        planetInfo.location.y >= space.space.y1 &&
        planetInfo.location.y <= space.space.y2;
      // let capturing: (TxStatus & {txHash: string}) | null | 'Loading' = null;
      let owner = planet.owner;
      let active = planet.active;
      let reward = planet.reward;
      let numSpaceships = planet.numSpaceships;
      let exiting = !!planet.exitTime;
      let exitTimeLeft = 0; // this.spaceInfo.exitDuration - (time - planet.exitTime);
      const natives = planet.lastUpdated == 0;
      if (planet.exitTime > 0 && time > planet.exitTime + spaceInfo.exitDuration) {
        // exited
        numSpaceships = 0;
        owner = '0x0000000000000000000000000000000000000000';
        active = false;
        exiting = false;
        exitTimeLeft = 0;
        reward = '0'; //BigNumber.from('0'); // TODO ?
      } else if (planet.active) {
        numSpaceships =
          planet.numSpaceships +
          Math.floor(
            ((time - planet.lastUpdated) * planetInfo.stats.production * spaceInfo.productionSpeedUp) / (60 * 60)
          );
      } else if (natives) {
        numSpaceships = planetInfo.stats.natives; // TODO show num Natives
      }

      // if (!active) {
      //   capturing = this.capturingStatus(planetId);
      // }

      planets.push({
        id: planetInfo.location.id,
        state: {
          owner,
          active,
          numSpaceships,
          exiting,
          exitTimeLeft,
          natives,
          capturing: null, // TODO
          inReach,
          reward: reward.toString(),
        },
      });
    }
    return planets;
  }

  private _callListeners(planetId: string, planet: PlanetState) {
    const listeners = this.planetListeners[planetId];
    if (listeners) {
      const num = listeners.length;
      for (let i = 0; i < num; i++) {
        const listenerIndex = listeners[i];
        const listener = this.listeners[listenerIndex];
        if (listener) {
          listener.func(planet);
        } else {
          // delete on demand (instead of on switchOffPlanetUpdates)
          listeners.splice(i, 1);
          // i--; // TODO check ?
          if (listeners.length === 0) {
            delete this.planetListeners[planetId];
          }
        }
      }
    }
  }
}

export const planetStates = new PlanetStates();
