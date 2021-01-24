<script lang="ts">
  // export let to: string = '';
  import resolveFlow from '../stores/resolve';
  import privateAccount from '../stores/privateAccount';
  import PanelButton from './PanelButton.svelte';
  import {spaceInfo} from '../app/mapState';
  import time from '../stores/time';
  import type {OwnFleet} from 'planet-wars-common';

  function resolve(fleetId: string) {
    resolveFlow.resolve(fleetId);
  }

  let fleets: ({id: string} & OwnFleet)[];
  $: {
    const now = $time;
    if (!$privateAccount.data) {
      fleets = [];
    } else {
      fleets = Object.keys($privateAccount.data.fleets)
        .map((fleetId) => {
          return {id: fleetId, ...$privateAccount.data.fleets[fleetId]};
        })
        .filter((fleet) => {
          if (fleet.resolveTxHash) {
            return false; // TOOO query it
          }

          const resolveWindow = spaceInfo.resolveWindow;
          const timeToResolve = fleet.launchTime + fleet.duration; // TODO launchTime : use actual launchTime
          const expiryTime = fleet.launchTime + fleet.duration + resolveWindow;
          if (now > expiryTime) {
            return false;
          }
          if (now < timeToResolve) {
            return false;
          }
          return true;
        });
    }
  }
</script>

<!-- TODO fliter on to-->

<div class="border mt-3 mr-1 flex flex-col">
  {#if fleets.length > 0}
    <h2 class="text-white p-1">Fleets to Resolve</h2>
  {/if}
  {#each fleets as fleet}
    <PanelButton
      class="m-1"
      label="Resolve Fleet"
      on:click={() => resolve(fleet.id)}>
      resolve
    </PanelButton>
  {/each}
</div>
