import type {OwnFleet, Planet, PrivateSpace} from 'planet-wars-common';
import type {RenderState} from '../types';

export class RenderStateImpl implements RenderState {
  constructor(private space: PrivateSpace) {
    // TODO this.space.on("<event>", ...)
  }

  private _counter = 0;
  get changeCounter(): number {
    this._counter++;
    return this._counter;
  }

  get player(): string {
    return this.space.player;
  }
  getOwnFleets(): OwnFleet[] {
    return this.space.getOwnFleets();
  }
  // getFleetsFrom(x: number, y: number): Fleet[] {
  //   return this.space.getFleetsFrom(x, y);
  // }
  // getFleetsTo(x: number, y: number): Fleet[] {
  //   return this.space.getFleetsTo(x, y);
  // }

  getPlanet(x: number, y: number): Planet | undefined {
    return this.space.getPlanet(x, y);
  }
}
