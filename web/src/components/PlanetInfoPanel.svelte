<script lang="ts">
  import type {Planet} from 'planet-wars-common';
  import {planet as getPlanet} from '../stores/planetsCache'; // TODO call it getPlanet / planetStore ?
  import claimFlow from '../stores/claim';
  import sendFlow from '../stores/send';
  import exitFlow from '../stores/exit';
  import {wallet} from '../stores/wallet';
  import privateAccount from '../stores/privateAccount';
  import time from '../stores/time';
  import {space} from '../app/mapState';

  import PanelButton from './PanelButton.svelte';
  import Blockie from './Blockie.svelte';

  export let planet: Planet;
  export let close: () => void;
  const planetUpdatable = getPlanet(planet.location.id);

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

  $: planetAcquired = {state:$planetUpdatable, stats: planet.stats};

  $: currentNumSpaceships = space.getCurrentNumSpaceships(planetAcquired, $time);
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
      {#if planetAcquired.state && planetAcquired.state.owner}
        <div>
          <Blockie
            class="flex-auto w-8 h-8 flot"
            address={planetAcquired.state.owner} />
        </div>
      {/if}
    </div>

    {#if planetAcquired.state} <!-- if active-->
    <div class="m-1">
      <label for="stake">exitTime:</label>
      <span id="stake" class="value">{planet.state.exitTime}</span>
    </div>
    <div class="m-1">
      <label for="stake">active:</label>
      <span id="stake" class="value">{planet.state.active}</span>
    </div>
    {/if}

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
    {#if planetAcquired.state}
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
      {#if planetAcquired.state}
        {#if $wallet.address}
          {#if planetAcquired.state.owner === '0x0000000000000000000000000000000000000000'}
            <PanelButton class="flex-auto" on:click={capture}>
              Capture
            </PanelButton>
          {:else if planetAcquired.state.owner.toLowerCase() === $wallet.address.toLowerCase()}
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
