import {readable} from 'svelte/store';

// TODO investigate why init.ts is not called first
if (!window.startTime) {
  console.log('need to set startTime');
  window.startTime = Math.floor(Date.now() / 1000);
} else {
  console.log('startTime already set');
}
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

// TODO remove
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).time = {
  now,
  startTime,
  correctTime,
  isCorrected,
  time,
};
console.log((window as any).time);
