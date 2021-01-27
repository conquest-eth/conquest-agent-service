<script lang="ts">
  import PanelButton from '../components/PanelButton.svelte';
  import Modal from '../components/Modal.svelte';
  import sendFlow from '../stores/send';
  import {onMount} from 'svelte';
  import {planetAt} from '../stores/planets';
  import {xyToLocation} from '../common/src';

  $: planetFrom = $sendFlow.data?.from
    ? planetAt(xyToLocation($sendFlow.data.from.x, $sendFlow.data.from.y))
    : undefined;

  // TODO maxSpaceshipsLoaded and invalid message if maxSpaceships == 0
  let fleetAmountSet: boolean = false;
  let fleetAmount: number = 1;
  let maxSpaceships: number;
  $: {
    maxSpaceships = $planetFrom.state.numSpaceships;
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

  <div class="text-center">
    <p class="font-bold">How many spaceships?</p>
  </div>
  <div class="my-2 bg-cyan-300 border-cyan-300 w-full h-1" />

  <div>
    <div>
      <!-- TODO show Token balance and warn when cannot buy // Token balance could be shown in navbar (once connected)-->
      <input
        class="text-cyan-300 bg-cyan-300"
        type="range"
        id="fleetAmount"
        name="fleetAmount"
        bind:value={fleetAmount}
        min="1"
        max={maxSpaceships} />
      <!-- <label for="fleetAmount">Number Of Spaceships</label> -->
      <input
        class="bg-gray-700 border-cyan-800 border-2"
        type="text"
        id="textInput"
        bind:value={fleetAmount} />
    </div>
    <div class="text-center">
      <PanelButton
        class="mt-5"
        label="Fleet Amount"
        on:click={() => sendFlow.confirm(fleetAmount)}>
        Confirm
      </PanelButton>
    </div>
  </div>
</Modal>
