import {BigNumber} from '@ethersproject/bignumber';
import type {PlanetUpdatableData, StateAdapter} from 'planet-wars-common';

export class StateAdapterFromTheGraph implements StateAdapter {
  getPlanetUpdatableData(x: number, y: number): PlanetUpdatableData {
    // TODO get from thegraph
    return {
      owner: '0x0000000000000000000000000000000000000000',
      lastOwnershipTime: 0,
      lastUpdated: 0,
      numSpaceships: 0,
      productionRate: 0,
      stake: BigNumber.from(0),
    };
  }
}
