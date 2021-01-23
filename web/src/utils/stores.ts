import {Writable, writable, Readable} from 'svelte/store';

export class BaseStore<T> implements Readable<T>{

  private store: Writable<T>;
  constructor(protected readonly $store: T) {
    this.store = writable(this.$store)
  }

  subscribe(run: (value: T) => void, invalidate?: (value?: T) => void): () => void {
    return this.store.subscribe(run, invalidate);
  }

  protected setPartial(obj: Partial<T>): T {
    for (const key of Object.keys(obj)) {
      if (this.$store[key] && typeof obj[key] === 'object') {
        for (const subKey of Object.keys(obj[key])) {
          // TODO recursve
          this.$store[key][subKey] = obj[key][subKey];
        }
      } else {
        this.$store[key] = obj[key];
      }
    }
    this.store.set(this.$store);
    return this.$store;
  }
  protected set(obj: T): T {
    for (const key of Object.keys(this.$store)) {
      this.$store[key] = undefined;
    }
    for (const key of Object.keys(obj)) {
      this.$store[key] = obj[key];
    }
    this.store.set(this.$store);
    return this.$store;
  }
}
