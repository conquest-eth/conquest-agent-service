import {BigNumber} from '@ethersproject/bignumber';
import {
  PlanetUpdatableData,
  StateAdapter,
  zoneFromLocation,
} from 'planet-wars-common';
import {cache} from '../stores/planetsCache';

export class StateAdapterFromTheGraph implements StateAdapter {
  getPlanetUpdatableData(x: number, y: number): PlanetUpdatableData {
    // TODO get from thegraph
    return cache.getPlanet(x, y);
  }
  isPlanetLoaded(x: number, y: number): boolean {
    return cache.isZoneLoaded(zoneFromLocation(x, y));
  }
}
