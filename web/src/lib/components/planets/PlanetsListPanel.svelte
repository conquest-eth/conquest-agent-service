<script lang="ts">
  import {myplanetInfos} from '$lib/space/myplanets';
  import {camera} from '$lib/map/camera';
  import selection from '$lib/map/selection';
  import type {PlanetInfo} from 'conquest-eth-common';

  let isToggled = false;

  function onPlanetSelect(planet: PlanetInfo) {
    selection.select(planet.location.x, planet.location.y);
    camera.navigate(planet.location.x * 2, planet.location.y * 2, 10);
  }
</script>

<div
  class="absolute top-0 text-center right-72 inline-block w-48 bg-gray-900 bg-opacity-80 text-cyan-300 border-2 border-cyan-300 m-4 text-sm"
>
  <button on:click={() => (isToggled = !isToggled)} class="text-white md:w-full">My Planets</button>
  {#if isToggled}
    <ul class="overflow-auto max-h-32" style="cursor: pointer;">
      {#each $myplanetInfos as planet}
        <li class="text-yellow-300" on:click={() => onPlanetSelect(planet)}>
          {planet.stats.name}
        </li>
      {/each}
    </ul>
  {/if}
</div>
