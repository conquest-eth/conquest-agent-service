<script lang="ts">
  import {fleets} from '$lib/space/fleets';
  import type {Fleet} from '$lib/space/fleets';
  import {clickOutside} from '$lib/utils/clickOutside';
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

<div class="flex-col" use:clickOutside on:click_outside={() => (isToggled = false)}>
  <div
    class="top-0 py-3 w-32 text-center relative bg-gray-900 bg-opacity-80 text-cyan-300 border-2 border-cyan-300 mt-4 text-sm"
  >
    <button on:click={() => (isToggled = !isToggled)} class="text-white md:w-full">My fleets</button>
  </div>
  {#if isToggled}
    <div
      class="top-0 text-center absolute bg-gray-900 bg-opacity-80 text-cyan-300 border-2 p-3  border-cyan-300 mt-16 text-sm"
    >
      {#if $fleets.length}
        <ul class="overflow-auto max-h-32 px-3 " style="cursor: pointer;">
          {#each $fleets as fleet}
            <li style="display: block" class="text-yellow-300 my-3" on:click={() => onFleetSelect(fleet)}>
             * {fleet.from.stats.name} to {fleet.to.stats.name}
              {#if fleet.gift}
                (GIFT)
              {/if}
            </li>
          {/each}
        </ul>
      {:else}
        <h4 style="margin: 10px 0">No fleets yet</h4>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* width */
::-webkit-scrollbar {
  width: 8px;
}

/* Track */
::-webkit-scrollbar-track {
  background: rgba(17, 24, 39, 0.8);
}

/* Handle */
::-webkit-scrollbar-thumb {
  background: #539ff0;
  border-radius: 100vh;
  border: 3px solid #edf2f7;
}

/* Handle on hover */
::-webkit-scrollbar-thumb:hover {
  background: #4690f0;
}
</style>
