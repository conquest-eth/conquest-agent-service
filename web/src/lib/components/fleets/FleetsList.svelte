<script lang="ts">
  import {fleets} from '$lib/space/fleets';
  import type {Fleet} from '$lib/space/fleets';
  import {camera} from '$lib/map/camera';

  let isToggled = false;
  let selectedFleet: Fleet;

  $: ratio = Math.max(0, (selectedFleet?.duration - selectedFleet?.timeLeft) / selectedFleet?.duration);

  $: x =
    selectedFleet?.from.location.globalX +
    (selectedFleet?.to.location.globalX - selectedFleet?.from.location.globalX) * ratio;
  $: y =
    selectedFleet?.from.location.globalY +
    (selectedFleet?.to.location.globalY - selectedFleet?.from.location.globalY) * ratio;

  $: selectedFleet && camera.navigate(Math.floor(x), Math.floor(y), 10);

  function onFleetSelect(fleet: Fleet) {
    selectedFleet = fleet;
  }
</script>

<div
  class="absolute top-0 text-center right-2/4 inline-block w-64 bg-gray-900 bg-opacity-80 text-cyan-300 border-2 border-cyan-300 m-4 text-sm"
>
  <button on:click={() => (isToggled = !isToggled)} class="text-white md:w-full">Fleets</button>
  {#if isToggled}
    {#if $fleets.length}
      <ul class="overflow-auto max-h-32" style="cursor: pointer;">
        {#each $fleets as fleet}
          <li class="text-yellow-300" on:click={() => onFleetSelect(fleet)}>
            {fleet.from.stats.name} to {fleet.to.stats.name}
          </li>
        {/each}
      </ul>
    {:else}
      <h4 style="margin: 10px 0">No fleets yet</h4>
    {/if}
  {/if}
</div>
