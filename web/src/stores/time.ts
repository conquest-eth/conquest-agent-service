import {readable} from 'svelte/store';

function now() {
  return Math.floor(Date.now() / 1000);
}

export const startTime = now();

export const time = readable(now(), function start(set) {
  const interval = setInterval(() => {
    set(now());
  }, 1000);

  return function stop() {
    clearInterval(interval);
  };
});
