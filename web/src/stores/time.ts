import {readable} from 'svelte/store';

function now() {
  return Math.floor(Date.now() / 1000);
}

export default readable(now(), function start(set) {
  const interval = setInterval(() => {
    set(now());
  }, 1000);

  return function stop() {
    clearInterval(interval);
  };
});
