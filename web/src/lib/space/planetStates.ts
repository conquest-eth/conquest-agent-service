import {blockTime} from '$lib/config';
import type {SpaceQueryWithPendingState, SyncedPendingActions} from '$lib/space/optimisticSpace';
import {spaceQueryWithPendingActions} from '$lib/space/optimisticSpace';
import {now, time} from '$lib/time';
import type {PlanetInfo, PlanetState} from 'conquest-eth-common';
import {xyToLocation} from 'conquest-eth-common';
import {spaceInfo} from './spaceInfo';
import type {PlanetContractState, SpaceState} from './spaceQuery';

type ListenerInfo = {planetInfo: PlanetInfo; func: (planetState: PlanetState) => void};

export class PlanetStates {
  private planetListeners: Record<string, number[] | undefined> = {};
  private listenerIndex = 0;
  private listeners: Record<number, ListenerInfo> = {};

  private spaceStateCache: SpaceQueryWithPendingState;
  private pendingActionsPerPlanet: {[location: string]: SyncedPendingActions};

  start(): void {
    time.subscribe(this.onTime.bind(this));
    spaceQueryWithPendingActions.subscribe(this.onSpaceUpdate.bind(this));
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
      this.processSpace(this.spaceStateCache, now());
    }

    return this.listenerIndex;
  }

  switchOffPlanetUpdates(listenerIndex: number): void {
    const {planetInfo} = this.listeners[listenerIndex];
    delete this.listeners[listenerIndex];

    // delete from planet if not needed anymore
    const planetId = planetInfo.location.id;
    const listeners = this.planetListeners[planetId];
    if (listeners) {
      const num = listeners.length;
      for (let i = 0; i < num; i++) {
        const listenerIndex = listeners[i];
        const listener = this.listeners[listenerIndex];
        if (!listener) {
          listeners.splice(i, 1);
          if (listeners.length === 0) {
            delete this.planetListeners[planetId];
          }
        }
      }
    }
  }

  private onTime() {
    if (this.spaceStateCache) {
      this.processSpace(this.spaceStateCache, now());
    }
  }

  private onSpaceUpdate(update: SpaceQueryWithPendingState): void {
    console.log(`on space update for planets`);
    if (!update.queryState.data) {
      console.log('hmmm, no data...');
      // TODO error
      return;
    }
    this.spaceStateCache = update;
    this.pendingActionsPerPlanet = {};
    for (const pendingAction of update.pendingActions) {
      if (pendingAction.action.type === 'CAPTURE') {
        const location = xyToLocation(pendingAction.action.planetCoords.x, pendingAction.action.planetCoords.y);
        const currentlist = (this.pendingActionsPerPlanet[location] = this.pendingActionsPerPlanet[location] || []);
        currentlist.push(pendingAction);
      } else if (pendingAction.action.type === 'SEND') {
        const location = xyToLocation(pendingAction.action.from.x, pendingAction.action.from.y);
        const currentlist = (this.pendingActionsPerPlanet[location] = this.pendingActionsPerPlanet[location] || []);
        currentlist.push(pendingAction);
      }
    }

    this.processSpace(update, now());
  }

  private processSpace(space: SpaceQueryWithPendingState, time: number): void {
    if (!space.queryState.data) {
      return;
    }

    const planetContractStates: {[id: string]: PlanetContractState} = {};
    for (const planetContractState of space.queryState.data.planets) {
      planetContractStates[planetContractState.id] = planetContractState;
    }

    const planetIds = Object.keys(this.planetListeners);
    for (const planetId of planetIds) {
      const listeners = this.planetListeners[planetId];
      if (listeners.length > 0) {
        const listenerInfo = this.listeners[listeners[0]];
        const planetState = this._transformPlanet(
          listenerInfo.planetInfo,
          space.queryState.data,
          this.pendingActionsPerPlanet,
          planetContractStates[listenerInfo.planetInfo.location.id],
          time
        );
        this._call(listeners, planetState);
      }
    }
  }

  private _transformPlanet(
    planetInfo: PlanetInfo,
    space: SpaceState,
    pendingActionsPerPlanet: {[location: string]: SyncedPendingActions},
    contractState: PlanetContractState | undefined,
    time: number
  ): PlanetState {
    const inReach =
      planetInfo.location.x >= space.space.x1 &&
      planetInfo.location.x <= space.space.x2 &&
      planetInfo.location.y >= space.space.y1 &&
      planetInfo.location.y <= space.space.y2;

    let owner: string | undefined = undefined;
    let active = false;
    let rewardGiver = '';
    let numSpaceships = planetInfo.stats.natives;
    let exiting = false;
    let exitTimeLeft = 0; // this.spaceInfo.exitDuration - (time - planet.exitTime);
    let natives = true;
    let capturing = false; // TODO object with pendignAction

    if (contractState) {
      owner = contractState.owner;
      active = contractState.active;
      rewardGiver = contractState.rewardGiver ? contractState.rewardGiver : '';
      numSpaceships = contractState.numSpaceships;
      exiting = !!contractState.exitTime;
      exitTimeLeft = Math.max(spaceInfo.exitDuration - (time - contractState.exitTime), 0);
      natives = contractState.lastUpdated == 0;

      if (contractState.exitTime > 0 && time > contractState.exitTime + spaceInfo.exitDuration) {
        // exited
        numSpaceships = 0;
        owner = undefined;
        active = false;
        exiting = false;
        exitTimeLeft = 0;
        rewardGiver = '';
      } else {
        let maxIncrease = Math.pow(2, 31);
        const timePassed = time - contractState.lastUpdated;
        if (spaceInfo.productionCapAsDuration && spaceInfo.productionCapAsDuration > 0) {
          let decrease = 0;
          const cap =
            spaceInfo.acquireNumSpaceships +
            Math.floor((spaceInfo.productionCapAsDuration * planetInfo.stats.production) / (60 * 60));
          // console.log({cap});
          if (numSpaceships > cap) {
            decrease = Math.floor((timePassed * 1800) / 3600) + blockTime * 2; // 1800 per hour // adjusted to cover block delays
            if (decrease > numSpaceships - cap) {
              decrease = numSpaceships - cap;
            }
            maxIncrease = 0;
          } else {
            maxIncrease = cap - numSpaceships;
          }

          if (contractState.active) {
            // adjusted to cover block delays
            let increase = Math.floor(
              (Math.max(0, timePassed - blockTime * 2) * planetInfo.stats.production * spaceInfo.productionSpeedUp) /
                (60 * 60)
            );
            if (increase > maxIncrease) {
              increase = maxIncrease;
            }
            numSpaceships += increase;
          }

          if (decrease > numSpaceships) {
            numSpaceships = 0; // not possible
          } else {
            numSpaceships -= decrease;
          }
        } else if (contractState.active) {
          // adjusted to cover block delays
          numSpaceships += Math.floor(
            (Math.max(0, timePassed - blockTime * 2) * planetInfo.stats.production * spaceInfo.productionSpeedUp) /
              (60 * 60)
          );
        }

        /*
         if (_productionCapAsDuration > 0) {
                uint256 decrease = 0;
                uint256 cap = _acquireNumSpaceships + _productionCapAsDuration * uint256(production) * _productionSpeedUp / 1 hours;
                if (currentNumSpaceships > cap) {
                    decrease = timePassed; // 1 per second
                    if (decrease > currentNumSpaceships - cap) {
                        decrease = currentNumSpaceships - cap;
                    }
                    maxIncrease = 0;
                } else {
                    maxIncrease = cap - currentNumSpaceships;
                }

                uint256 increase = (timePassed * uint256(production) * _productionSpeedUp) / 1 hours;
                if (increase > maxIncrease) {
                    increase = maxIncrease;
                }
                newSpaceships += increase;
                if (decrease > newSpaceships) {
                    newSpaceships = 0; // not possible
                } else {
                    newSpaceships -= decrease;
                }
            } else {
                newSpaceships += (timePassed * uint256(production) * _productionSpeedUp) / 1 hours;
            }
        */
      }

      if (natives) {
        numSpaceships = planetInfo.stats.natives; // TODO show num Natives
      }
    }

    let requireClaimAcknowledgement: string | undefined = undefined;

    const pendingActions = pendingActionsPerPlanet[planetInfo.location.id];
    if (pendingActions) {
      for (const pendingAction of pendingActions) {
        // TODO
        if (pendingAction.status === 'FAILURE') {
          continue;
        } else if (pendingAction.status === 'CANCELED') {
          continue;
        } else if (pendingAction.status === 'TIMEOUT') {
          continue;
        }

        if (!pendingAction.counted) {
          // should we ensure that if counted, status becomes SUCCESS ? see pendingActions.ts
          if (pendingAction.action.type === 'CAPTURE') {
            capturing = true;
          } else if (pendingAction.action.type === 'SEND') {
            numSpaceships -= pendingAction.action.quantity;
          }
        } else if (!pendingAction.action.acknowledged) {
          if (pendingAction.action.type === 'CAPTURE') {
            requireClaimAcknowledgement = pendingAction.id;
          }
        }
      }
    }

    return {
      owner,
      active,
      numSpaceships,
      exiting,
      exitTimeLeft,
      natives,
      capturing,
      inReach,
      rewardGiver,
      requireClaimAcknowledgement,
    };
  }

  // private _transform(space: SpaceState, time: number): {state: PlanetState; id: string}[] {
  //   const planets: {state: PlanetState; id: string}[] = [];
  //   for (const planet of space.planets) {
  //     const planetInfo = spaceInfo.getPlanetInfoViaId(planet.id);
  //     if (!planetInfo) {
  //       continue;
  //     }
  //     const inReach =
  //       planetInfo.location.x >= space.space.x1 &&
  //       planetInfo.location.x <= space.space.x2 &&
  //       planetInfo.location.y >= space.space.y1 &&
  //       planetInfo.location.y <= space.space.y2;
  //     // let capturing: (TxStatus & {txHash: string}) | null | 'Loading' = null;
  //     let owner = planet.owner;
  //     let active = planet.active;
  //     let rewardGiver = planet.rewardGiver;
  //     let numSpaceships = planet.numSpaceships;
  //     let exiting = !!planet.exitTime;
  //     let exitTimeLeft = 0; // this.spaceInfo.exitDuration - (time - planet.exitTime);
  //     const natives = planet.lastUpdated == 0;
  //     if (planet.exitTime > 0 && time > planet.exitTime + spaceInfo.exitDuration) {
  //       // exited
  //       numSpaceships = 0;
  //       owner = '0x0000000000000000000000000000000000000000';
  //       active = false;
  //       exiting = false;
  //       exitTimeLeft = 0;
  //       rewardGiver = '';
  //     } else if (planet.active) {
  //       numSpaceships =
  //         planet.numSpaceships +
  //         Math.floor(
  //           ((time - planet.lastUpdated) * planetInfo.stats.production * spaceInfo.productionSpeedUp) / (60 * 60)
  //         );
  //     } else if (natives) {
  //       numSpaceships = planetInfo.stats.natives; // TODO show num Natives
  //     }

  //     // if (!active) {
  //     //   capturing = this.capturingStatus(planetId);
  //     // }

  //     planets.push({
  //       id: planetInfo.location.id,
  //       state: {
  //         owner,
  //         active,
  //         numSpaceships,
  //         exiting,
  //         exitTimeLeft,
  //         natives,
  //         capturing: null, // TODO
  //         inReach,
  //         rewardGiver,
  //       },
  //     });
  //   }
  //   return planets;
  // }

  // private _callListeners(planetId: string, planet: PlanetState) {
  //   const listeners = this.planetListeners[planetId];
  //   if (listeners) {
  //     const num = listeners.length;
  //     for (let i = 0; i < num; i++) {
  //       const listenerIndex = listeners[i];
  //       const listener = this.listeners[listenerIndex];
  //       if (listener) {
  //         listener.func(planet);
  //       } else {
  //         // delete on demand (instead of on switchOffPlanetUpdates) // not necessary anymore as currently handled by switchOffPlanetUpdates
  //         listeners.splice(i, 1);
  //         // i--; // TODO check ?
  //         if (listeners.length === 0) {
  //           delete this.planetListeners[planetId];
  //         }
  //       }
  //     }
  //   }
  // }

  private _call(listeners: number[], planet: PlanetState): void {
    const num = listeners.length;
    for (let i = 0; i < num; i++) {
      const listenerIndex = listeners[i];
      const listener = this.listeners[listenerIndex];
      if (listener) {
        listener.func(planet);
      }
    }
  }
}

export const planetStates = new PlanetStates();
