import type {PrivateSpace} from '../common/src';

export class RenderState {
  constructor(public space: PrivateSpace) {}

  private _counter = 0;
  get changeCounter(): number {
    this._counter++;
    return this._counter;
  }
}
