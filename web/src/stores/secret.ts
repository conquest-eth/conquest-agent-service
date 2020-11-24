import {writable} from 'svelte/store';

type Position = {x: number; y: number};
type FleetData = {
  to: Position;
  from: Position;
  fleetAmount: number;
};

type SecretData = {
  fleets: Record<string, FleetData>;
};

const $data: SecretData = {
  fleets: {},
};
const {subscribe, set} = writable($data);

function _set(obj: Partial<SecretData>): SecretData {
  for (const key of Object.keys(obj)) {
    $data[key] = obj[key];
  }
  set($data);
  return $data;
}

// technically only `to` and `fleetId` are required, but saving from and fleetAmount allow to get the info faster and more reliably
function recordFleet(
  fleetId: string,
  fleetData: {to: Position; from: Position; fleetAmount: number}
) {
  const fleets = $data.fleets;
  fleets[fleetId] = fleetData;
  _set({
    fleets,
  });
}

let dataStore;
export default dataStore = {
  subscribe,
  recordFleet,
};

/* eslint-disable @typescript-eslint/no-explicit-any */
if (typeof window !== 'undefined') {
  (window as any).secrets = dataStore;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
