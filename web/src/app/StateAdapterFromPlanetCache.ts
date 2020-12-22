import type {
  PlanetUpdatableData,
  StateAdapter
} from 'planet-wars-common';
import {cache} from '../stores/planetsCache';

export class StateAdapterFromPlanetCache implements StateAdapter {
  getPlanetUpdatableData(x: number, y: number): PlanetUpdatableData {
    return cache.getPlanet(x, y);
  }
}
