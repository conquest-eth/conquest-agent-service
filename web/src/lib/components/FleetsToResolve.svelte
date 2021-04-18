<script lang="ts">
  // export let to: string = '';
  import resolveFlow from '$lib/stores/resolve';
  import privateAccount from '$lib/stores/privateAccount';
  import PanelButton from './PanelButton.svelte';
  import {spaceInfo, space} from '$lib/app/mapState';
  import {time} from '$lib/stores/time';
  import type {OwnFleet} from 'conquest-eth-common';
  import {timeToText} from '$lib/utils';

  function resolve(fleetId: string) {
    resolveFlow.resolve(fleetId);
  }

  $: agentActive =
    $privateAccount.data?.agentHeartBeat && $privateAccount.data?.agentHeartBeat.keepAlive > $time - 5 * 60;

  let fleets: ({id: string; timeToResolve: number; expiryTime: number} & OwnFleet)[];
  $: {
    const now = $time;
    if (!$privateAccount.data) {
      fleets = [];
    } else {
      fleets = Object.keys($privateAccount.data.fleets)
        .map((fleetId) => {
          const fleet = $privateAccount.data.fleets[fleetId];
          const resolveWindow = spaceInfo.resolveWindow;
          const timeToResolve = (fleet.actualLaunchTime || fleet.launchTime) + fleet.duration;
          const expiryTime = timeToResolve + resolveWindow;

          return {id: fleetId, ...fleet, expiryTime, timeToResolve};
        })
        .filter((fleet) => {
          if (fleet.resolveTx) {
            const txStatus = privateAccount.txStatus(fleet.resolveTx.hash);
            if (!txStatus || txStatus === 'Loading' || txStatus.status !== 'Failure') {
              return false;
            }
          }

          // if (agentActive) {
          //   if (fleet.timeToResolve < now + 5 * 60) {
          //     return false; // if agent active filter out fleet as they are getting resolved
          //   }
          // }

          if (now > fleet.expiryTime) {
            return false;
          }
          if (now < fleet.timeToResolve) {
            return false;
          }
          return true;
        });
    }
  }
</script>

<!-- TODO fliter on to-->

{#if fleets.length > 0}
  <div class="border-2 border-red-600 mt-3 mr-1 flex flex-col text-center text-cyan-300">
    <h2 class="p-1">Fleets to Resolve</h2>
    <div class="w-full h-1 bg-red-600 mt-1 mb-2" />
    {#each fleets as fleet}
      {#if agentActive && fleet.timeToResolve < $time + 5 * 60}
        <div class="border border-cyan-400 w-24 mx-auto">Agent Resolving...</div>
      {:else}
        <PanelButton class="m-1" label="Resolve Fleet" on:click={() => resolve(fleet.id)}>
          {timeToText(space.spaceInfo.resolveWindow + space.timeLeft($time, fleet.from, fleet.to, fleet.actualLaunchTime || fleet.launchTime).timeLeft)}
          left
          <!-- {spaceInfo.getPlanetInfo(fleet.to.x, fleet.to.y)?.stats.name} -->
        </PanelButton>
      {/if}
    {/each}
    <div class="w-full mt-1" />
  </div>
{/if}
