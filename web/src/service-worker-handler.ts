import type {Logger} from 'named-logs';
import {logs} from 'named-logs';
import {serviceWorker} from '$lib/web/serviceWorker';
import {base} from '$app/paths';

const log = logs('service-worker') as Logger & {level: number; enabled: boolean};
function updateLoggingForWorker(worker: ServiceWorker | null) {
  if (worker) {
    if (log.enabled) {
      log.debug(`enabling logging for service worker, level: ${log.level}`);
    } else {
      log.debug(`disabling logging for service worker, level: ${log.level}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    worker.postMessage({type: 'debug', level: log.level, enabled: log.enabled});
  }
}

const IDLE_DELAY_MS = 3 * 60 * 1000;
const CHECK_DELAY_MS = 30 * 60 * 1000;

function handleAutomaticUpdate(registration: ServiceWorkerRegistration) {
  let lastFocusTime = performance.now();
  function wakeup() {
    const timePassed = performance.now();
    // console.log('wakeup ', lastFocusTime / 60 / 1000, 'vs', timePassed / 60 / 1000);
    if (timePassed - lastFocusTime > IDLE_DELAY_MS) {
      registration.update();
    }
    lastFocusTime = timePassed;
  }
  ['focus', 'pointerdown'].forEach((evt) => window.addEventListener(evt, wakeup));

  setInterval(() => registration.update(), CHECK_DELAY_MS);
}

// taken from: https://stackoverflow.com/a/50535316
function listenForWaitingServiceWorker(
  registration: ServiceWorkerRegistration,
  callback: (reg: ServiceWorkerRegistration) => void
) {
  function awaitStateChange() {
    registration.installing.addEventListener('statechange', function () {
      if (this.state === 'installed') callback(registration);
    });
  }
  if (!registration) {
    return;
  }
  if (registration.waiting) {
    return callback(registration);
  }
  if (registration.installing) {
    awaitStateChange();
  } else {
    registration.addEventListener('updatefound', awaitStateChange);
  }
}

if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  // ------------------------------------------------------------------------------------------------
  // FORCE RELOAD ON CONTROLLER CHANGE
  // ------------------------------------------------------------------------------------------------
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) {
      return;
    }
    refreshing = true;
    window.location.reload();
  });
  // ------------------------------------------------------------------------------------------------

  window.addEventListener('load', function () {
    const swLocation = `${base}/service-worker.js`;
    //{scope: base}
    navigator.serviceWorker
      .register(swLocation)
      .then((registration) => {
        try {
          handleAutomaticUpdate(registration);
        } catch (e) {}
        serviceWorker.set({registration, updateAvailable: false}); // TODO keep updateAvailable if any ?
        updateLoggingForWorker(registration.installing);
        updateLoggingForWorker(registration.waiting);
        updateLoggingForWorker(registration.active);
        listenForWaitingServiceWorker(registration, () => {
          console.log('[Service Worker] Update found');
          serviceWorker.set({registration, updateAvailable: true});
        });
      })
      .catch((e) => {
        console.log(e);
        // console.error('Failed to register service worker', e);
      });
  });
}
