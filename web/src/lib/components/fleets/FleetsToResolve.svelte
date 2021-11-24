<script lang="ts">
  import {fleetList} from '$lib/space/fleets';

  import resolveFlow from '$lib/flows/resolve';
  import PanelButton from '$lib/components/generic/PanelButton.svelte';
  import {time} from '$lib/time';
  import {timeToText} from '$lib/utils';
  import type {Fleet} from '$lib/space/fleets';

  function resolve(fleet: Fleet) {
    resolveFlow.resolve(fleet);
  }
  $: fleetsToResolve = $fleetList.fleets.filter((fleet) => fleet.state === 'READY_TO_RESOLVE');

  // $: console.log(fleetsToResolve);
</script>

<!-- TODO fliter on to-->

{#if fleetsToResolve.length > 0}
  <div class="border-2 border-red-600 mt-3 mr-1 text-center text-cyan-300 ">
    <h2 class="p-1">Fleets to Resolve</h2>
    <div class="w-full h-1 bg-red-600 mt-1 mb-2 " />
    <div class="overflow-auto max-h-48 flex flex-col text-center">
    {#each fleetsToResolve as fleet}
      <!-- {#if agentActive && fleet.timeToResolve < $time + 5 * 60} -->
      <!-- <div class="border border-cyan-400 w-24 mx-auto">Agent Resolving...</div> -->
      <!-- {:else} -->
      <PanelButton class="m-1" label="Resolve Fleet" on:click={() => resolve(fleet)}>
        {timeToText(fleet.timeToResolve)}
        left
        <!-- {spaceInfo.getPlanetInfo(fleet.to.x, fleet.to.y)?.stats.name} -->
      </PanelButton>
      <!-- {/if} -->
    {/each}
  </div>
    <div class="w-full mt-1" />
  </div>
{/if}
