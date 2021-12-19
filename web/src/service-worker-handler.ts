import {Logger, logs} from 'named-logs';
import {updateAvailable} from './lib/web/appUpdates';
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
        updateLoggingForWorker(registration.installing);
        updateLoggingForWorker(registration.waiting);
        updateLoggingForWorker(registration.active);
        listenForWaitingServiceWorker(registration, () => {
          console.log('[Service Worker] Update found');
          updateAvailable.set(registration);
        });
      })
      .catch((e) => {
        console.log(e);
        // console.error('Failed to register service worker', e);
      });
  });
}
