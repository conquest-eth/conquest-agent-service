import {writable} from 'svelte/store';

type Destination = {x: number, y: number;};

type SecretData = {
  fleetDestinations: Record<string, Destination>
};

const $data: SecretData = {
  fleetDestinations: {}
}
const {subscribe, set} = writable($data);

function _set(
  obj: Partial<SecretData>
): SecretData {
  for (const key of Object.keys(obj)) {
    $data[key] = obj[key];
  }
  set($data);
  return $data;
}

function recordFleet(fleetId: string, to: Destination) {
  const fleetDestinations = $data.fleetDestinations;
  fleetDestinations[fleetId] = to;
  _set({
    fleetDestinations
  });
}

let dataStore;
export default dataStore = {
  subscribe,
  recordFleet
};

/* eslint-disable @typescript-eslint/no-explicit-any */
if (typeof window !== 'undefined') {
  (window as any).secrets = dataStore;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
