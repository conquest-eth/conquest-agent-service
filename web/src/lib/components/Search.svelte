<script lang="ts">
  import {base} from '$app/paths';

  import {spaceInfo} from '$lib/app/mapState';
  import selection from '$lib/stores/selection';

  let coords: string;
  function go(): void {
    const split = coords.split(',').map((v) => v.trim());
    if (split.length === 2) {
      const x = parseInt(split[0]);
      const y = parseInt(split[1]);
      (window as any).camera.navigate(x * 48 * 2 * 4, y * 48 * 2 * 4);
      const planet = spaceInfo.getPlanetInfo(x, y);
      if (planet) {
        selection.select(planet.location.id);
      }
    }
  }

  function showLogs() {}
</script>

<div class="absolute inline-block w-28 bg-gray-900 bg-opacity-80 text-cyan-300 border-2 border-cyan-300 m-4 text-sm">
  <div class="flex m-1">
    <h2 class={`flex-auto text-center pt-1 font-bold text-white`}>Enter coords</h2>
  </div>
  <div class="w-full h-1 bg-cyan-300 my-2" />
  <input
    bind:value={coords}
    class="relative inline-block ml-1 max-w-lg shadow-sm w-14 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300 rounded-md bg-gray-700"
    type="text" />
  <button class="relative inline-block border border-cyan-500 my-1 px-1 text-center" on:click={go}>GO</button>
  <div class="w-full h-1 bg-cyan-300 mt-2" />
  <a class="relative inline-block border border-cyan-500 ml-8 my-2 px-1 text-center" href={`${base}/logs/`}>LOGS</a>
  <div class="w-full h-1 bg-cyan-300" />
  <a
    class="relative inline-block border border-cyan-500 ml-3 my-2 px-1 text-center"
    href={`${base}/highscores/`}>Highscores</a>
</div>
