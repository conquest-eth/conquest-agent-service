import {Writable, writable, Readable} from 'svelte/store';

type DataType = Record<string, unknown | Record<string, unknown>>;

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
function _recurseSet(target: any, obj: any) {
  for (const key of Object.keys(obj)) {
    if (
      target[key] &&
      typeof target[key] === 'object' &&
      typeof obj[key] === 'object'
    ) {
      _recurseSet(target[key], obj[key]);
    } else {
      target[key] = obj[key];
    }
  }
}

export class BaseStore<T extends DataType> implements Readable<T> {
  private store: Writable<T>;
  constructor(protected readonly $store: T) {
    this.store = writable(this.$store);
  }

  subscribe(
    run: (value: T) => void,
    invalidate?: (value?: T) => void
  ): () => void {
    return this.store.subscribe(run, invalidate);
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
  protected setRecursivePartial(obj: any): T {
    _recurseSet(this.$store, obj);
    this.store.set(this.$store);
    return this.$store;
  }

  protected setPartial(obj: Partial<T>): T {
    _recurseSet(this.$store, obj);
    this.store.set(this.$store);
    return this.$store;
  }
  protected set(obj: T): T {
    // Testing hmr for subclasses
    //   const objAny: any = obj;
    //   objAny.value += 7;
    for (const key of Object.keys(this.$store)) {
      (this.$store as Record<string, unknown>)[key] = undefined;
    }
    for (const key of Object.keys(obj)) {
      (this.$store as Record<string, unknown>)[key] = obj[key];
    }
    this.store.set(this.$store);
    return this.$store;
  }
}
