<script>
  import {spaceView} from '$lib/space/spaceInfo';
  import {wallet} from '$lib/blockchain/wallet';
  import {onMount} from 'svelte';
  let planets = [];
  let isToggled = false;
  onMount(() => {
    planets = $spaceView.filter((planet) => planet.owner?.toLowerCase() === $wallet.address?.toLowerCase());
    console.log($wallet);
  });
</script>

<div
  class="absolute top-0 text-center right-72 inline-block w-48 bg-gray-900 bg-opacity-80 text-cyan-300 border-2 border-cyan-300 m-4 text-sm"
>
  <button on:click={() => (isToggled = !isToggled)} class="text-white">My Planets</button>
  {#if isToggled}
    <ul>
      {#each planets as planet}
        <li class="text-yellow-300" on:click={() => console.log(planet)}>{planet.stats.name}</li>
      {/each}
    </ul>
  {/if}
</div>
