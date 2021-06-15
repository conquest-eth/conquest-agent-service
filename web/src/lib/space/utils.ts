import {BigNumber} from '@ethersproject/bignumber';
import type {PlanetInfo, PlanetState} from 'conquest-eth-common';

function combat(
  attack: number,
  numAttack: BigNumber,
  defense: number,
  numDefense: BigNumber
): {defenderLoss: BigNumber; attackerLoss: BigNumber; attackDamage: BigNumber} {
  const attackDamage = numAttack.mul(attack).div(defense);

  if (numAttack.eq(0) || numDefense.eq(0)) {
    return {defenderLoss: BigNumber.from(0), attackerLoss: BigNumber.from(0), attackDamage};
  }

  if (numDefense.gt(attackDamage)) {
    // attack fails
    return {
      attackerLoss: numAttack, // all attack destroyed
      defenderLoss: attackDamage, // 1 spaceship will be left at least as defenderLoss < numDefense
      attackDamage,
    };
  } else {
    // attack succeed
    let defenseDamage = numDefense.mul(defense).div(attack);
    if (defenseDamage.gte(numAttack)) {
      defenseDamage = numAttack.sub(1);
    }
    return {
      attackerLoss: defenseDamage,
      defenderLoss: numDefense, // all defense destroyeda
      attackDamage,
    };
  }
}

export function simulateCapture(
  from: string,
  planetInfo: PlanetInfo,
  planetState: PlanetState
): {
  success: boolean;
  numSpaceshipsLeft: number;
} {
  console.log(planetState.owner, from);
  if (planetState.owner && planetState.owner.toLowerCase() === from.toLowerCase()) {
    return {
      success: true,
      numSpaceshipsLeft: planetState.numSpaceships + 100000, // TODO use contract _acquireNumSpaceships
    };
  }

  // Do not allow staking over occupied planets
  if (!planetState.natives) {
    if (planetState.numSpaceships > 0) {
      return {
        success: false,
        numSpaceshipsLeft: planetState.numSpaceships,
      };
    }
  }

  const numDefense = planetState.natives ? planetInfo.stats.natives : planetState.numSpaceships;
  const {attackerLoss} = combat(
    10000,
    BigNumber.from(100000), // TODO use contract _acquireNumSpaceships
    planetInfo.stats.defense,
    BigNumber.from(numDefense)
  );

  if (attackerLoss.lt(100000)) {
    return {
      success: true,
      numSpaceshipsLeft: 100000 - attackerLoss.toNumber(),
    };
  } else {
    return {
      success: false,
      numSpaceshipsLeft: planetState.numSpaceships,
    };
  }
}
