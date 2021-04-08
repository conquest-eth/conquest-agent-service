import type {PrivateSpace} from '$lib/common/src';

export class RenderState {
  constructor(public space: PrivateSpace) {}

  private _counter = 0;
  get changeCounter(): number {
    this._counter++;
    return this._counter;
  }
}
