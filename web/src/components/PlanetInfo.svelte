<script lang="ts">
  export let planet;
  import {planets} from '../stores/planets';
  import claimFlow from '../stores/claim';
  $: planetAcquired =
    $planets.data[`${planet.location.x},${planet.location.y}`];
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
    {#if planetAcquired}
      <div>
        <label for="owner">owner:</label>
        <span id="oener" class="value">{planetAcquired.owner}</span>
      </div>
      <div>
        <label for="ownerTime">ownerTime:</label>
        <span
          id="ownerTime"
          class="value">{planetAcquired.lastOwnershipTime}</span>
      </div>
      <div>
        <label for="stake">stake:</label>
        <span id="stake" class="value">{planetAcquired.stake}</span>
      </div>
      <div>
        <label for="productionRate">production:</label>
        <span
          id="productionRate"
          class="value">{planetAcquired.productionRate}</span>
      </div>
      <div>
        <label for="numSpaceships">spaceships:</label>
        <span
          id="numSpaceships"
          class="value">{planetAcquired.numSpaceships}</span>
      </div>
      <div>
        <label for="lastUpdated">lastUpdated:</label>
        <span id="lastUpdated" class="value">{planetAcquired.lastUpdated}</span>
      </div>
    {:else}
      <div>
        <label for="natives">natives:</label>
        <span id="natives" class="value">{planet.stats.natives}</span>
      </div>
      <button on:click={() => claimFlow.claim(planet)}>CLAIM</button>
    {/if}
  </div>
</div>
