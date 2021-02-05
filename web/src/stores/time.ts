import {readable} from 'svelte/store';

export let startTime = window.startTime;

export function now(): number {
  return Math.floor(performance.now() / 1000) + startTime;
}

let _corrected = false;
export function correctTime(actualTime: number): void {
  const currentTime = now();
  const diff = actualTime - currentTime;
  if (Math.abs(diff) > 60) {
    // only adapt if difference is significant
    startTime += diff;
  }
  _corrected = true;
}

export function isCorrected(): boolean {
  return _corrected;
}

export const time = readable(now(), function start(set) {
  const interval = setInterval(() => {
    set(now());
  }, 1000);

  return function stop() {
    clearInterval(interval);
  };
});
