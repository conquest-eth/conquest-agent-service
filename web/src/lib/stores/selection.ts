import {BaseStore} from '$lib/utils/stores/base';

export type Selection = {
  id?: string;
};

class SelectionStore extends BaseStore<Selection> {
  constructor() {
    super({
      id: undefined,
    });
  }

  get id() {
    return this.$store.id;
  }

  select(id: string): void {
    this.set({id});
  }

  unselect(): void {
    this.set({id: undefined});
  }
}

export default new SelectionStore();
