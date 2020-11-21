<script lang="ts">
  import Banner from '../components/Banner.svelte';
  import Button from '../components/Button.svelte';
  import Modal from '../components/Modal.svelte';
  import sendFlow from '../stores/send';
  import {planet as getPlanet} from '../stores/planetsCache'; // TODO call it getPlanet / planetStore ?
  import { xyToLocation } from 'planet-wars-common';
  import time from  '../stores/time';

  $: pickNeeded =
    $sendFlow.step === 'PICK_DESTINATION'
      ? 'destination'
      : $sendFlow.step === 'PICK_ORIGIN'
      ? 'origin'
      : undefined;

  // TODO remove duplicae : move to util
  function _getCurrentNumSpaceships(time: number, numSpaceships: number, lastUpdated: number, productionRate: number) : number {
    return numSpaceships + Math.floor(((time - lastUpdated) * productionRate) / (60*60));
  }
  function numSpaceshipFor(time, planetAcquired) {
    return planetAcquired ? _getCurrentNumSpaceships(time, parseInt(planetAcquired.numSpaceships), parseInt(planetAcquired.lastUpdated), planetAcquired.productionRate) : 0;
  }

  $: planetFrom = $sendFlow.data?.to ? getPlanet(xyToLocation($sendFlow.data.to.x, $sendFlow.data.to.y)) : undefined;
  $: maxSpaceships = numSpaceshipFor($time, $planetFrom);

  $: console.log({maxSpaceships, planetFrom});
  let fleetAmount = 1;
</script>

{#if pickNeeded}
  <Banner on:close={() => sendFlow.cancel()}>
    <p class="font-medium text-white">
      <span class="inline" />
      {#if pickNeeded === 'destination'}
        Pick the Destination
      {:else}Pick the Origin{/if}
    </p>
  </Banner>
{:else if $sendFlow.step === 'CHOOSE_FLEET_AMOUNT'}
  <Modal
    on:close={() => sendFlow.cancel()}
    on:confirm={() => sendFlow.confirm(fleetAmount)}>
    <!-- <h2 slot="header">Claim Planet {location.x},{location.y}</h2> -->

    <p>How many spaceships?</p>

    <div>
      <!-- TODO show DAI balance and warn when cannot buy // DAI balance could be shown in navbar (once connected)-->
      <input
        type="range"
        id="fleetAmount"
        name="fleetAmount"
        bind:value={fleetAmount} min="1" max="{maxSpaceships}" /> <!-- TODO max range = numSpaceships-->
      <label for="fleetAmount">Number Of Spaceships</label>
      <input type="text" id="textInput" value={fleetAmount} />
    </div>
    <Button label="Fleet Amount" on:click={() => sendFlow.confirm(fleetAmount)}>
      Confirm
    </Button>
  </Modal>
{/if}
