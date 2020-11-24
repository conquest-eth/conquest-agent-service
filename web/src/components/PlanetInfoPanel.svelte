<script lang="ts">
  import type {Planet} from 'planet-wars-common';
  import {zoneFromLocation} from 'planet-wars-common';
  import {planet as getPlanet} from '../stores/planetsCache'; // TODO call it getPlanet / planetStore ?
  import claimFlow from '../stores/claim';
  import sendFlow from '../stores/send';
  import {wallet} from '../stores/wallet';
  import login from '../stores/login';
  import time from '../stores/time';

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

  function connect() {
    login.login();
  }

  // TODO remove duplicae : move to util
  function _getCurrentNumSpaceships(
    time: number,
    numSpaceships: number,
    lastUpdated: number,
    productionRate: number
  ): number {
    return (
      numSpaceships +
      Math.floor(((time - lastUpdated) * productionRate) / (60 * 60))
    );
  }
  function numSpaceshipFor(time, planetAcquired) {
    return planetAcquired
      ? _getCurrentNumSpaceships(
          time,
          parseInt(planetAcquired.numSpaceships),
          parseInt(planetAcquired.lastUpdated),
          planetAcquired.productionRate
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
  style=" background-color: #000000; color: white; opacity: 0.5; position: absolute; ">
  <!-- <img class="h-16 w-16 rounded-full mx-auto" src="avatar.jpg"> -->
  <div>
    <h2>Planet {planet.location.x},{planet.location.y}</h2>
    <div>
      <label for="maxStake">maxStake:</label>
      <span id="maxStake" class="value">{planet.stats.maxStake}</span>
    </div>
    <div>
      <label for="production">maxProduction:</label>
      <span id="production" class="value">{planet.stats.production}</span>
    </div>
    <div>
      <label for="attack">attack:</label>
      <span id="attack" class="value">{planet.stats.attack}</span>
    </div>
    <div>
      <label for="defense">defense:</label>
      <span id="defense" class="value">{planet.stats.defense}</span>
    </div>
    <div>
      <label for="speed">speed:</label>
      <span id="speed" class="value">{planet.stats.speed}</span>
    </div>
    {#if $planetAcquired}
      <div>
        <label for="owner">owner:</label>
        <span id="oener" class="value">{$planetAcquired.owner}</span>
      </div>
      <div>
        <label for="ownerTime">ownerTime:</label>
        <span
          id="ownerTime"
          class="value">{$planetAcquired.lastOwnershipTime}</span>
      </div>
      <div>
        <label for="stake">stake:</label>
        <span id="stake" class="value">{$planetAcquired.stake}</span>
      </div>
      <div>
        <label for="productionRate">production:</label>
        <span
          id="productionRate"
          class="value">{$planetAcquired.productionRate}</span>
      </div>
      <div>
        <label for="numSpaceships">spaceships:</label>
        <span id="numSpaceships" class="value">{currentNumSpaceships}</span>
      </div>
      <div>
        <label for="lastUpdated">lastUpdated:</label>
        <span
          id="lastUpdated"
          class="value">{$planetAcquired.lastUpdated}</span>
      </div>
      {#if $wallet.address}
        {#if $planetAcquired.owner === '0x0000000000000000000000000000000000000000'}
          <button on:click={capture}>Capture</button>
        {:else if $planetAcquired.owner.toLowerCase() === $wallet.address.toLowerCase()}
          <button on:click={sendTo}>Send To</button>
          <button on:click={sendFrom}>Send From</button>
        {:else}<button on:click={sendTo}>Attack</button>{/if}
      {:else}<button on:click={connect}>Connect Wallet</button>{/if}
    {:else}
      <div>
        <label for="natives">natives:</label>
        <span id="natives" class="value">{planet.stats.natives}</span>
      </div>
      <button on:click={capture}>Capture</button>
    {/if}
  </div>
</div>
