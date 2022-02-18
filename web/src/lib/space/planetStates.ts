import {blockTime} from '$lib/config';
import type {SpaceQueryWithPendingState, SyncedPendingActions} from '$lib/space/optimisticSpace';
import {spaceQueryWithPendingActions} from '$lib/space/optimisticSpace';
import {now, time} from '$lib/time';
import type {PlanetInfo, PlanetState} from 'conquest-eth-common';
import {xyToLocation} from 'conquest-eth-common';
import {spaceInfo} from './spaceInfo';
import type {PlanetContractState, SpaceState} from './spaceQuery';

type ListenerInfo = {planetInfo: PlanetInfo; func: (planetState: PlanetState) => void};

function hours(numHours: number): number {
  return 60 * 60 * numHours;
}
function days(n: number): number {
  return hours(n * 24);
}

const ACTIVE_MASK = 2 ** 31;

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

    // TODO object with pendignAction
    let capturing = false;

    let travelingUpkeep = 0;
    let overflow = 0;

    if (contractState) {
      owner = contractState.owner;
      active = contractState.active;
      rewardGiver = contractState.rewardGiver ? contractState.rewardGiver : '';
      numSpaceships = contractState.numSpaceships;
      travelingUpkeep = contractState.travelingUpkeep;
      overflow = contractState.overflow;
      exiting = !!contractState.exitTime;
      exitTimeLeft = Math.max(spaceInfo.exitDuration - (time - contractState.exitTime), 0);
      natives = contractState.lastUpdated == 0;

      if (contractState.exitTime > 0 && time > contractState.exitTime + spaceInfo.exitDuration) {
        // exited
        numSpaceships = 0;
        travelingUpkeep = 0;
        overflow = 0;
        owner = undefined;
        active = false;
        exiting = false;
        exitTimeLeft = 0;
        rewardGiver = '';
      } else {
        const timePassed = time - contractState.lastUpdated;
        const safeTimePassed = Math.max(0, timePassed - blockTime * 2);
        const production = planetInfo.stats.production;
        const produce = Math.floor(
          (safeTimePassed * planetInfo.stats.production * spaceInfo.productionSpeedUp) / hours(1)
        );

        // NOTE: the repaypemnt of upkeep always happen at a fixed rate (per planet), it is fully predictable
        let upkeepRepaid = 0;
        if (travelingUpkeep > 0) {
          upkeepRepaid = Math.floor((produce * spaceInfo.upkeepProductionDecreaseRatePer10000th) / 10000);
          if (upkeepRepaid > travelingUpkeep) {
            upkeepRepaid = travelingUpkeep;
          }
          travelingUpkeep = travelingUpkeep - upkeepRepaid;
        }

        let newNumSpaceships = numSpaceships;
        let extraUpkeepPaid = 0;
        if (spaceInfo.productionCapAsDuration > 0) {
          // NOTE no need of productionSpeedUp for the cap because _productionCapAsDuration can include it
          const cap = active
            ? Math.floor(spaceInfo.acquireNumSpaceships + (production * spaceInfo.productionCapAsDuration) / hours(1))
            : 0;

          if (newNumSpaceships > cap) {
            let decreaseRate = 1800;
            if (overflow > 0) {
              decreaseRate = Math.floor((overflow * 1800) / cap);
              if (decreaseRate < 1800) {
                decreaseRate = 1800;
              }
            }
            let decrease = Math.floor((timePassed * decreaseRate) / hours(1));
            if (decrease > newNumSpaceships - cap) {
              decrease = newNumSpaceships - cap;
            }
            if (decrease > newNumSpaceships) {
              if (active) {
                extraUpkeepPaid = produce - upkeepRepaid + newNumSpaceships;
              }
              newNumSpaceships = 0;
            } else {
              if (active) {
                extraUpkeepPaid = produce - upkeepRepaid + decrease;
              }
              newNumSpaceships -= decrease;
            }
          } else {
            if (active) {
              const maxIncrease = cap - newNumSpaceships;
              let increase = produce - upkeepRepaid;
              if (increase > maxIncrease) {
                extraUpkeepPaid = increase - maxIncrease;
                increase = maxIncrease;
              }
              newNumSpaceships += increase;
            } else {
              // not effect currently, when inactive, cap == 0, meaning zero spaceship here
              // NOTE: we could do the following assuming we act on upkeepRepaid when inactive, we do not do that currently
              //  extraUpkeepPaid = produce - upkeepRepaid;
            }
          }

          if (active) {
            // travelingUpkeep can go negative allow you to charge up your planet for later use, up to 7 days
            let newTravelingUpkeep = travelingUpkeep - extraUpkeepPaid;
            if (newTravelingUpkeep < -planetInfo.stats.maxTravelingUpkeep) {
              newTravelingUpkeep = -planetInfo.stats.maxTravelingUpkeep;
            }
            travelingUpkeep = newTravelingUpkeep;
          }
        } else {
          if (active) {
            newNumSpaceships +=
              Math.floor((timePassed * production * spaceInfo.productionSpeedUp) / hours(1)) - upkeepRepaid;
          } else {
            // NOTE no need to overflow here  as there is no production cap, so no incentive to regroup spaceships
            let decrease = Math.floor((timePassed * 1800) / hours(1));
            if (decrease > newNumSpaceships) {
              decrease = newNumSpaceships;
              newNumSpaceships = 0;
            } else {
              newNumSpaceships -= decrease;
            }
          }
        }

        if (newNumSpaceships >= ACTIVE_MASK) {
          newNumSpaceships = ACTIVE_MASK - 1;
        }
        numSpaceships = newNumSpaceships;
        //   let maxIncrease = Math.pow(2, 31);
        //   const timePassed = time - contractState.lastUpdated;
        //   if (spaceInfo.productionCapAsDuration && spaceInfo.productionCapAsDuration > 0) {
        //     let decrease = 0;
        //     const cap =
        //       spaceInfo.acquireNumSpaceships +
        //       Math.floor((spaceInfo.productionCapAsDuration * planetInfo.stats.production) / (60 * 60));
        //     // console.log({cap});
        //     if (numSpaceships > cap) {
        //       decrease = Math.floor((timePassed * 1800) / 3600) + blockTime * 2; // 1800 per hour // adjusted to cover block delays
        //       if (decrease > numSpaceships - cap) {
        //         decrease = numSpaceships - cap;
        //       }
        //       maxIncrease = 0;
        //     } else {
        //       maxIncrease = cap - numSpaceships;
        //     }

        //     if (contractState.active) {
        //       // adjusted to cover block delays
        //       let increase = Math.floor(
        //         (Math.max(0, timePassed - blockTime * 2) * planetInfo.stats.production * spaceInfo.productionSpeedUp) /
        //           (60 * 60)
        //       );
        //       if (increase > maxIncrease) {
        //         increase = maxIncrease;
        //       }
        //       numSpaceships += increase;
        //     }

        //     if (decrease > numSpaceships) {
        //       numSpaceships = 0; // not possible
        //     } else {
        //       numSpaceships -= decrease;
        //     }
        //   } else if (contractState.active) {
        //     // adjusted to cover block delays
        //     numSpaceships += Math.floor(
        //       (Math.max(0, timePassed - blockTime * 2) * planetInfo.stats.production * spaceInfo.productionSpeedUp) /
        //         (60 * 60)
        //     );
        //   }
        //   // TODO  overflow / travelingUpkeep
      }

      if (natives) {
        // TODO show num Natives
        numSpaceships = planetInfo.stats.natives;
      }
    }

    let requireClaimAcknowledgement: string | undefined = undefined;

    const pendingActions = pendingActionsPerPlanet[planetInfo.location.id];
    if (pendingActions) {
      for (const pendingAction of pendingActions) {
        if (pendingAction.status === 'LOADING') {
          continue;
        }

        // TODO ?
        if (pendingAction.status === 'SUCCESS' && pendingAction.final) {
          continue;
        }

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
      travelingUpkeep,
      overflow,
      exiting,
      exitTimeLeft,
      natives,
      capturing,
      inReach,
      rewardGiver,
      requireClaimAcknowledgement,
    };
  }

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
