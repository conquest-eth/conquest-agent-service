import type {OwnFleet, Planet, PrivateSpace} from 'planet-wars-common';
import type {RenderState} from '../types';

export class RenderStateImpl implements RenderState {
  public resolveWindow: number;
  public timePerDistance: number;

  constructor(private space: PrivateSpace) {
    // TODO this.space.on("<event>", ...)
    this.resolveWindow = space.resolveWindow;
    this.timePerDistance = space.timePerDistance;
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

  isActive(planet: Planet, time: number): boolean {
    return this.space.isActive(planet, time);
  }

  isExiting(planet: Planet, time: number): boolean {
    return this.space.isExiting(planet, time);
  }


  exitRatio(planet: Planet, time: number): number {
    return this.space.exitRatio(planet, time);
  }
}
