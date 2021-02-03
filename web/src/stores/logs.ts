import {writable} from 'svelte/store';

const d: string[] = [];
const l = writable(d);

export default {
  subscribe: l.subscribe,
  add(m: string): void {
    l.update((v: string[]) => {
      v.push(m);
      return v;
    });
  },
};
