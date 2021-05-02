<script lang="ts">
  import {wallet} from '$lib/stores/wallet';
  import {planetAt} from '$lib/stores/planets';

  import Blockie from './Blockie.svelte';
  import Stat from './Stat.svelte';
  import PlayCoin from './PlayCoin.svelte';
  import {timeToText} from '$lib/utils';
  import Help from './Help.svelte';
  import PlanetActionPanel from './PlanetActionPanel.svelte';
  import selection from '$lib/stores/selection';
  import Tooltip from './Tooltip.svelte';

  export let location: string;
  function close() {
    selection.unselect();
  }

  function _select(elem: HTMLElement) {
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(elem);
    (selection as any).removeAllRanges();
    (selection as any).addRange(range);
  }
  function select(e: MouseEvent) {
    _select(e.currentTarget as HTMLElement);
  }

  $: planet = planetAt(location);

  $: walletIsOwner = $wallet.address && $wallet.address?.toLowerCase() === $planet.state?.owner.toLowerCase();
  $: textColor =
    $planet.state && $planet.state.owner !== '0x0000000000000000000000000000000000000000'
      ? walletIsOwner
        ? 'text-green-500'
        : 'text-red-500'
      : 'text-gray-100';
</script>

<div class="absolute inline-block w-48 bg-gray-900 bg-opacity-80 text-cyan-300 border-2 border-cyan-300 m-4 text-sm">
  <div class="flex m-1">
    {#if $planet.state && $planet.state.owner !== '0x0000000000000000000000000000000000000000'}
      <h2 class={`flex-auto text-center pt-1 font-bold ${textColor} inline`}>{$planet.stats.name}</h2>
      <!-- <Tooltip class={`flex-auto text-center pt-1 font-bold ${textColor} inline`}>
        <h2>{$planet.stats.name}</h2>
        <p slot="tooltip">{$planet.location.id}</p>
      </Tooltip> -->
      <div>
        <Blockie class="flex-auto w-8 h-8 flot" address={$planet.state.owner} />
      </div>
    {:else}
      <h2 class={`flex-auto text-center pt-1 font-bold ${textColor} inline`}>{$planet.stats.name}</h2>
      <!-- <Tooltip class={`flex-auto text-center pt-1 font-bold ${textColor} inline`}>
        <h2 class="flex-auto  ${textColor} text-center pt-1 font-bold">{$planet.stats.name}</h2>
        <p slot="tooltip">{$planet.location.id}</p>
      </Tooltip> -->
    {/if}
  </div>
  {#if $planet.state && $planet.state.owner !== '0x0000000000000000000000000000000000000000'}
    <h2 on:click={select} class={`flex-auto text-center -m-2 font-bold text-white`}>
      {$planet.location.x},{$planet.location.y}
    </h2>
  {:else}
    <h2 on:click={select} class={`flex-auto text-center font-bold text-white`}>
      {$planet.location.x},{$planet.location.y}
    </h2>
  {/if}
  <div class="w-full h-1 bg-cyan-300 my-2" />

  <div class="m-2">
    {#if $planet.state}
      <!-- if active-->
      <!-- <div class="m-1">
        <label for="active">active:</label>
        <span id="active" class="value">{$planet.state.active}</span>
      </div> -->
      {#if $planet.state.exiting}
        <div class="m-1 w-36 flex justify-between text-red-400">
          <p class="p-0 mb-1">Exiting in:</p>
          <p class="p-0 mb-1">{timeToText($planet.state.exitTimeLeft)}</p>
        </div>
      {/if}
    {/if}

    <!-- {#if !$planet.state || $planet.state.natives}
      <div class="m-1">
        <label for="natives">natives:</label>
        <span id="natives" class="value">{$planet.stats.natives}</span>
      </div>
    {:else}
      <div class="m-1">
        <label for="numSpaceships">spaceships:</label>
        <span
          id="numSpaceships"
          class="value">{$planet.state.numSpaceships}</span>
      </div>
    {/if} -->

    <div class={'m-1 w-36 flex justify-between' + ($planet.state?.active ? ' text-green-400' : ' text-gray-400')}>
      {#if !$planet.state}
        <p class="p-0 mb-1">loading ...</p>
      {:else if $planet.state.natives}
        <p class="p-0 mb-1">
          Natives
          <Help class="inline w-4 h-4">
            When a planet is not owned by anyone, it has some natives population that need to be conquered.
          </Help>
          :
        </p>
        <p class="p-0 mb-1">{$planet.stats.natives}</p>
      {:else}
        <p class="p-0 mb-1 {textColor}">
          Spaceships
          <Help class="inline w-4 h-4">
            The number of spaceships present on the planet. These spaceships can be used for attacks or left on the
            planet for defense. When a planet is active, that it is, a stake has been deposited, it continuosly produce
            new spaceships.
          </Help>:
        </p>
        <p class="p-0 mb-1 {textColor}">{$planet.state.numSpaceships}</p>
      {/if}
    </div>

    <div class="m-1 w-36 text-yellow-400 ">
      <div class="w-full box-border">
        <p class="p-0 mb-1">
          Stake
          <Help class="inline w-4 h-4">
            This is the amount of
            <PlayCoin class="inline w-4" />
            required to stake to produce spaceships. This is also the amount that you (or someone capturing the planet)
            can withdraw back after exiting the planet.
          </Help>
        </p>
        <p class="float-right relative -top-6">
          {$planet.stats.stake}
          <PlayCoin class="inline w-4" />
        </p>
        <div class="box-border rounded-md bg-gray-600">
          <div class="w-full h-3 rounded-md bg-yellow-400" style="width: {Math.floor($planet.stats.stake)}%;" />
        </div>
      </div>
    </div>
    <Stat name="Production" value={$planet.stats.production} max={12000} min={1500}>
      <Help class="inline w-4 h-4">This is the rate of spaceship production per hour.</Help>
    </Stat>
    <Stat name="Attack" value={$planet.stats.attack} max={10000} min={3600}>
      <Help class="inline w-4 h-4">This is the attack strength of spaceships departing from this planet.</Help>
    </Stat>
    <Stat name="Defense" value={$planet.stats.defense} max={10000} min={3600}>
      <Help class="inline w-4 h-4">This is the defense strength of spaceships defending this planet.</Help>
    </Stat>
    <Stat name="Speed" value={$planet.stats.speed} max={10000} min={4500}>
      <Help class="inline w-4 h-4">
        This is the speed at which spaceship departing from this planet travels in unit per hour.
      </Help>
    </Stat>
  </div>
  <div class="w-full h-1 bg-cyan-300 mt-4 mb-2" />
  <PlanetActionPanel {close} {location} />
</div>
