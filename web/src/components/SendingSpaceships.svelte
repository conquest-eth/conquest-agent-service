<script lang="ts">
  import Button from '../components/Button.svelte';
  import Modal from '../components/Modal.svelte';
  import sendFlow from '../stores/send';
  import {onMount} from 'svelte';
  import {planet as getPlanet} from '../stores/planetsCache'; // TODO call it getPlanet / planetStore ?
  import {xyToLocation} from 'planet-wars-common';
  import time from '../stores/time';

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

  $: planetFrom = $sendFlow.data?.from
    ? getPlanet(xyToLocation($sendFlow.data.from.x, $sendFlow.data.from.y))
    : undefined;

  // TODO maxSpaceshipsLoaded and invalid message if maxSpaceships == 0
  let fleetAmountSet: boolean = false;
  let fleetAmount: number = 1;
  let maxSpaceships: number;
  $: {
    maxSpaceships = numSpaceshipFor($time, $planetFrom);
    if (maxSpaceships > 0 && !fleetAmountSet) {
      // TODO loading
      fleetAmount = Math.floor(maxSpaceships / 2);
      fleetAmountSet = true;
    }
  }

  $: console.log({maxSpaceships, planetFrom, fleetAmount, fleetAmountSet});

  onMount(() => {
    fleetAmount = 1;
    fleetAmountSet = false;
  });
</script>

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
      bind:value={fleetAmount}
      min="1"
      max={maxSpaceships} />
    <!-- TODO max range = numSpaceships-->
    <label for="fleetAmount">Number Of Spaceships</label>
    <input type="text" id="textInput" value={fleetAmount} />
  </div>
  <Button label="Fleet Amount" on:click={() => sendFlow.confirm(fleetAmount)}>
    Confirm
  </Button>
</Modal>
