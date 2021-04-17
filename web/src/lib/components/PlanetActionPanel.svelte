<script lang="ts">
  import PlanetFleetActionPanel from './PlanetFleetActionPanel.svelte';
  import PlanetFleetResultPanel from './PlanetFleetResultPanel.svelte';
  import PlanetExitResultPanel from './PlanetExitResultPanel.svelte';
  import privateAccount from '$lib/stores/privateAccount';
  import {time} from '$lib/stores/time';
  import type {OwnFleet} from 'conquest-eth-common/types';
  import {locationToXY} from 'conquest-eth-common';
  import {contracts as contractsInfo} from '$lib/app/contractInfos';

  export let location: string;
  export let close: () => void;

  let planetX: number;
  let planetY: number;
  let fleets: ({
    id: string;
    status: 'Error' | 'Success' | 'Expired';
  } & OwnFleet)[];
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
        if (fleet.toDelete) {
          continue;
        }
        let status: 'Success' | 'Error' | 'Expired' | undefined;
        if (fleet.resolveTx) {
          const txStatus = privateAccount.txStatus(fleet.resolveTx.hash);
          if (txStatus && txStatus !== 'Loading' && txStatus.status !== 'Pending' && txStatus.status !== 'Cancelled') {
            // TODO Cancelled ?
            if (fleet.to.x === planetX && fleet.to.y === planetY) {
              status = txStatus.status === 'Failure' ? 'Error' : 'Success';
            }
          }
        } else {
          const txStatus = privateAccount.txStatus(fleet.sendTx.hash);
          if (txStatus && txStatus !== 'Loading' && txStatus.status === 'Failure') {
            // TODO Cancelled ?
            if (fleet.from.x === planetX && fleet.from.y === planetY) {
              status = txStatus.status === 'Failure' ? 'Error' : 'Success';
            }
          } else if (fleet.to.x === planetX && fleet.to.y === planetY) {
            const launchTime = fleet.actualLaunchTime || fleet.launchTime;
            const resolveWindow = contractsInfo.contracts.OuterSpace.linkedData.resolveWindow;
            const expiryTime = launchTime + fleet.duration + resolveWindow;

            if (expiryTime < $time) {
              status = 'Expired';
            }
          }
        }
        if (status) {
          fleets.push({id: fleetId, ...fleet, status});
        }
      }
    }
  }

  let exitFailure: {txHash: string; location: string} | undefined;
  $: {
    exitFailure = undefined;
    if ($privateAccount.data) {
      const exit = $privateAccount.data.exits[location];
      if (exit) {
        const txStatus = privateAccount.txStatus(exit.txHash);
        if (txStatus && txStatus !== 'Loading') {
          if (txStatus.status === 'Failure') {
            exitFailure = {txHash: exit.txHash, location};
          }
        }
      }
    }
  }
</script>

<div class="flex flex-col text-center">
  {#if exitFailure}
    <PlanetExitResultPanel exit={exitFailure} />
  {:else if fleets.length > 0}
    <PlanetFleetResultPanel fleet={fleets[0]} />
  {:else}
    <PlanetFleetActionPanel {close} {location} />
  {/if}
  <div class="w-full mt-2" />
</div>
