<script lang="ts">
  import {myplanetInfos} from '$lib/space/myplanets';
  import {clickOutside} from '$lib/utils/clickOutside';
  import {camera} from '$lib/map/camera';
  import selection from '$lib/map/selection';
  import type {PlanetInfo} from 'conquest-eth-common';

  let isToggled = false;

  function onPlanetSelect(planet: PlanetInfo) {
    selection.select(planet.location.x, planet.location.y);
    camera.navigate(planet.location.globalX, planet.location.globalY, 10);
  }
</script>

<div class="flex-col" use:clickOutside on:click_outside={() => (isToggled = false)}>
  <div
    class="top-0 p-3 w-32 text-center relative bg-gray-900 bg-opacity-80 text-cyan-300 border-2 border-cyan-300 mt-4 text-sm"
  >
    <button on:click={() => (isToggled = !isToggled)} class="text-white md:w-full">My planets</button>
  </div>
  {#if isToggled}
    <div
      class="top-0 p-3 text-center absolute bg-gray-900 bg-opacity-80 text-cyan-300 border-2 border-cyan-300 mt-16 text-sm"
    >
      {#if $myplanetInfos.length}
        <ul class="overflow-auto max-h-32" style="cursor: pointer;">
          {#each $myplanetInfos as planet}
            <li class="text-yellow-300" on:click={() => onPlanetSelect(planet)}>
              {planet.stats.name}
            </li>
          {/each}
        </ul>
      {:else}
        <h4 style="margin: 10px 0">No planets yet</h4>
      {/if}
    </div>
  {/if}
</div>
