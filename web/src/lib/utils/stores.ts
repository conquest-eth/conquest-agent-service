import {Writable, writable, Readable} from 'svelte/store';

type DataType = Record<string, unknown | Record<string, unknown>>;

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

  protected setPartial(obj: Partial<T>): T {
    for (const key of Object.keys(obj)) {
      if (this.$store[key] && typeof obj[key] === 'object') {
        const subObj: Record<string, unknown> = obj[key] as Record<
          string,
          unknown
        >;
        if (typeof subObj === 'object') {
          for (const subKey of Object.keys(subObj as {})) {
            // TODO recursve
            (this.$store[key] as Record<string, unknown>)[subKey] =
              subObj[subKey];
          }
        }
      } else {
        (this.$store as Record<string, unknown>)[key] = obj[key];
      }
    }
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

// TODO store subclass via constructor
// then loop through them to replace the protoype down the chain
// (async () => {
//   if (import.meta.hot) {
//     const previousModule = await import(import.meta.url);
//     import.meta.hot.accept(({module}) => {
//     for (const field of Object.keys(module)) {
//         const newPrototype = Reflect.getPrototypeOf(module[field]);
//         Reflect.setPrototypeOf(previousModule[field], newPrototype);
//     }
//     });
//  }
// })();
