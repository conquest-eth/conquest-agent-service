<script lang="ts">
  import type {Planet} from 'planet-wars-common';
  import {zoneFromLocation} from 'planet-wars-common';
  import {planet as getPlanet} from '../stores/planetsCache'; // TODO call it getPlanet / planetStore ?
  import claimFlow from '../stores/claim';
  import sendFlow from '../stores/send';
  import exitFlow from '../stores/exit';
  import {wallet} from '../stores/wallet';
  import privateAccount from '../stores/privateAccount';
  import time from '../stores/time';

  import PanelButton from './PanelButton.svelte';
  import Blockie from './Blockie.svelte';

  export let planet: Planet;
  export let close: () => void;
  const planetAcquired = getPlanet(planet.location.id);

  function capture() {
    claimFlow.claim(planet);
  }

  function sendTo() {
    sendFlow.sendTo(planet.location);
    close();
  }

  function sendFrom() {
    sendFlow.sendFrom(planet.location);
    close();
  }

  function exitFrom() {
    exitFlow.exitFrom(planet.location);
    close();
  }

  function connect() {
    privateAccount.login();
  }

  // TODO remove duplicae : move to util
  function _getCurrentNumSpaceships(
    time: number,
    numSpaceships: number,
    lastUpdated: number,
    production: number
  ): number {
    return (
      numSpaceships +
      Math.floor(((time - lastUpdated) * production) / (60 * 60))
    );
  }
  function numSpaceshipFor(time, planetAcquired) {
    return planetAcquired
      ? _getCurrentNumSpaceships(
          time,
          parseInt(planetAcquired.numSpaceships),
          parseInt(planetAcquired.lastUpdated),
          planet.stats.production
        )
      : 0;
  }

  $: currentNumSpaceships = numSpaceshipFor($time, $planetAcquired);
</script>

<style>
  .frame label,
  .frame .value {
    display: inline-block;
  }
  .frame label {
    min-width: 110px;
  }
</style>

<div
  class="frame"
  style=" background-color: #00000077; color: gray; position: absolute; ">
  <!-- <img class="h-16 w-16 rounded-full mx-auto" src="avatar.jpg"> -->
  <div>
    <div class="flex m-1">
      <h2 class="flex-auto text-white font-bold">
        Planet
        {planet.location.x},{planet.location.y}
      </h2>
      {#if $planetAcquired && $planetAcquired.owner}
        <div>
          <Blockie
            class="flex-auto w-8 h-8 flot"
            address={$planetAcquired.owner} />
        </div>
      {/if}
    </div>

    <div class="m-1">
      <label for="stake">stake:</label>
      <span id="stake" class="value">{planet.stats.stake}</span>
    </div>
    <div class="m-1">
      <label for="production">production:</label>
      <span id="production" class="value">{planet.stats.production}</span>
    </div>
    <div class="m-1">
      <label for="attack">attack:</label>
      <span id="attack" class="value">{planet.stats.attack}</span>
    </div>
    <div class="m-1">
      <label for="defense">defense:</label>
      <span id="defense" class="value">{planet.stats.defense}</span>
    </div>
    <div class="m-1">
      <label for="speed">speed:</label>
      <span id="speed" class="value">{planet.stats.speed}</span>
    </div>
    {#if $planetAcquired}
      <div class="m-1">
        <label for="numSpaceships">spaceships:</label>
        <span id="numSpaceships" class="value">{currentNumSpaceships}</span>
      </div>
    {:else}
      <div class="m-1">
        <label for="natives">natives:</label>
        <span id="natives" class="value">{planet.stats.natives}</span>
      </div>
    {/if}
    <div class="flex flex-col">
      {#if $planetAcquired}
        {#if $wallet.address}
          {#if $planetAcquired.owner === '0x0000000000000000000000000000000000000000'}
            <PanelButton class="flex-auto" on:click={capture}>
              Capture
            </PanelButton>
          {:else if $planetAcquired.owner.toLowerCase() === $wallet.address.toLowerCase()}
            <PanelButton class="m-1 flex-auto" on:click={sendTo}>
              Send To
            </PanelButton>
            <PanelButton class="m-1 flex-auto" on:click={sendFrom}>
              Send From
            </PanelButton>
            <PanelButton class="m-1 flex-auto" on:click={exitFrom}>
              Exit
            </PanelButton>
          {:else}
            <PanelButton class="m-1 flex-auto" on:click={sendTo}>
              Attack
            </PanelButton>
          {/if}
        {:else}
          <PanelButton class="m-1 flex-auto" on:click={connect}>
            Connect Wallet
          </PanelButton>
        {/if}
      {:else}
        <PanelButton class="m-1 flex-auto" on:click={capture}>
          Capture
        </PanelButton>
      {/if}
    </div>
  </div>
</div>
