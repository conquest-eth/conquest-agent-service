import {BigNumber} from '@ethersproject/bignumber';
import type {PlanetUpdatableData, StateAdapter} from 'planet-wars-common';
import {cache} from '../stores/planetsCache';

export class StateAdapterFromTheGraph implements StateAdapter {
  getPlanetUpdatableData(x: number, y: number): PlanetUpdatableData {
    // TODO get from thegraph
    return cache.getPlanet(x, y);
  }
}
