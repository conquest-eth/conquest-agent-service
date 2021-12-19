import {writable} from 'svelte/store';

export const updateAvailable = writable<ServiceWorkerRegistration>(undefined);
