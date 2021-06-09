import {BaseStore} from '$lib/utils/stores/base';

export type Selection = {
  x: number;
  y: number;
};

class SelectionStore extends BaseStore<Selection> {
  constructor() {
    super(undefined);
  }

  select(x: number, y: number): void {
    this.set({x, y});
  }

  unselect(): void {
    this.set(undefined);
  }
}

export default new SelectionStore();
