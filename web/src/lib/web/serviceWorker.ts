import {writable} from 'svelte/store';

export type ServiceWorkerState = {
  registration?: ServiceWorkerRegistration;
  updateAvailable: boolean;
};

export const serviceWorker = writable<ServiceWorkerState>({registration: undefined, updateAvailable: false});

// TODO remove
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).serviceWorker = serviceWorker;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).version = __VERSION__;
}
