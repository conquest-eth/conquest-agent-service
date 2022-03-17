import type {PlanetInfo, PlanetState} from 'conquest-eth-common';
import {derived} from 'svelte/store';
import type {Readable} from 'svelte/store';
import {planets} from './planets';
import type {Fleet} from './fleets';
import {fleetList} from './fleets';
import {spaceInfo} from './spaceInfo';
import {now} from '$lib/time';
import {playersQuery} from './playersQuery';

export type FutureInfo = {
  state: PlanetState;
  fleet: Fleet;
  arrivalTime: number;
  accumulatedAttack: number;
  accumulatedDefense: number;
  averageAttackPower: number;
};

export type PlanetFutureState = FutureInfo[];

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
        let lastInfo: FutureInfo | undefined;
        let futureState = $planetState;

        const currentTime = now();
        let lastTime = currentTime;

        for (const fleet of fleets) {
          let accumulatedAttackAdded = 0;
          let accumulatedDefenseAdded = 0;
          let attackPower = fleet.from.stats.attack;

          if (fleet.arrivalTimeWanted > 0) {
            if (lastInfo && lastInfo.arrivalTime === fleet.arrivalTimeWanted) {
              attackPower = Math.floor(
                (lastInfo.accumulatedAttack * lastInfo.averageAttackPower + fleet.quantity * fleet.from.stats.attack) /
                  (fleet.quantity + lastInfo.accumulatedAttack)
              );
              accumulatedAttackAdded = lastInfo.accumulatedAttack;
              accumulatedDefenseAdded += lastInfo.accumulatedDefense;
            }
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
            fleet.quantity + accumulatedAttackAdded,
            fleet.timeLeft,
            playersQuery.getPlayer(fleet.fleetSender),
            playersQuery.getPlayer(fleet.owner),
            playersQuery.getPlayer($planetState.owner),
            fleet.gift,
            fleet.specific,
            {
              attackPowerOverride: attackPower,
              defense: accumulatedDefenseAdded,
            }
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
              arrivalTime: lastTime,
              accumulatedAttack: outcome.combat.attackerLoss,
              accumulatedDefense: outcome.combat.defenderLoss,
              averageAttackPower: attackPower,
              state: futureState,
              fleet,
            });
          } else {
            if (lastInfo) {
              lastInfo.accumulatedAttack = outcome.combat.attackerLoss;
              lastInfo.accumulatedDefense = outcome.combat.defenderLoss;
              lastInfo.averageAttackPower = attackPower;
            }
          }
        }
        return futures;
      });
    }
    return store;
  }
}

export const planetFutureStates = new PlanetFutureStateStores();
