import type {Fleet, Planet, PrivateSpace, Space} from 'planet-wars-common';
import type {RenderState} from '../types';

export class RenderStateImpl implements RenderState {
  constructor(private space: PrivateSpace) {
    // TODO this.space.on("<event>", ...)
  }

  get player(): string {
    return this.space.player;
  }
  getFleets(): Fleet[] {
    return this.space.getFleets();
  }
  getFleetsFrom(x: number, y: number): Fleet[] {
    return this.space.getFleetsFrom(x, y);
  }
  getFleetsTo(x: number, y: number): Fleet[] {
    return this.space.getFleetsTo(x, y);
  }

  getPlanet(x: number, y: number): Planet | undefined {
    return this.space.getPlanet(x, y);
  }
}
