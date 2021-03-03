<script lang="ts">
  import PlanetFleetActionPanel from './PlanetFleetActionPanel.svelte';
  import PlanetFleetResultPanel from './PlanetFleetResultPanel.svelte';
  import privateAccount from '../stores/privateAccount';
  import {time} from '../stores/time';
  import type {OwnFleet} from '../common/src/types';
  import {locationToXY} from '../common/src';

  export let location: string;
  export let close: () => void;

  let planetX: number;
  let planetY: number;
  let fleets: ({id: string; status: 'Error' | 'Success'} & OwnFleet)[];
  $: {
    const xy = locationToXY(location);
    planetX = xy.x;
    planetY = xy.y;
    const now = $time;
    if (!$privateAccount.data) {
      fleets = [];
    } else {
      fleets = [];
      const fleetIds = Object.keys($privateAccount.data.fleets);
      for (const fleetId of fleetIds) {
        const fleet = $privateAccount.data.fleets[fleetId];
        let status: 'Success' | 'Error' | undefined;
        if (fleet.resolveTxHash) {
          const txStatus = privateAccount.txStatus(fleet.resolveTxHash);
          if (
            txStatus &&
            txStatus !== 'Loading' &&
            txStatus.status !== 'Pending' &&
            txStatus.status !== 'Cancelled'
          ) {
            // TODO Cancelled ?
            if (fleet.to.x === planetX && fleet.to.y === planetY) {
              status = txStatus.status === 'Failure' ? 'Error' : 'Success';
            }
          }
        } else if (fleet.sendTxHash) {
          const txStatus = privateAccount.txStatus(fleet.sendTxHash);
          if (
            txStatus &&
            txStatus !== 'Loading' &&
            txStatus.status === 'Failure'
          ) {
            // TODO Cancelled ?
            if (fleet.from.x === planetX && fleet.from.y === planetY) {
              status = txStatus.status === 'Failure' ? 'Error' : 'Success';
            }
          }
        }
        if (status) {
          fleets.push({id: fleetId, ...fleet, status});
        }
      }
    }
  }
</script>

<div class="flex flex-col text-center">
  {#if fleets.length > 0}
    <PlanetFleetResultPanel fleet={fleets[0]} />
  {:else}
    <PlanetFleetActionPanel {close} {location} />
  {/if}
  <div class="w-full mt-2" />
</div>
