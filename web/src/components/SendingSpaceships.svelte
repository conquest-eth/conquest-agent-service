<script lang="ts">
  import PanelButton from '../components/PanelButton.svelte';
  import Modal from '../components/Modal.svelte';
  import sendFlow from '../stores/send';
  import {onMount} from 'svelte';
  import {planetAt} from '../stores/planets';
  import {xyToLocation} from '../common/src';
  import {space} from '../app/mapState';
  import {timeToText} from '../lib/utils';

  $: planetFrom = $sendFlow.data?.from
    ? planetAt(xyToLocation($sendFlow.data.from.x, $sendFlow.data.from.y))
    : undefined;

  $: planetTo = $sendFlow.data?.to
    ? planetAt(xyToLocation($sendFlow.data.to.x, $sendFlow.data.to.y))
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

  let prediction:
    | {
        arrivalTime: string;
        numSpaceshipsAtArrival: number;
        outcome: {captured: boolean; numSpaceshipsLeft: number};
      }
    | undefined = undefined;
  $: {
    if (planetTo && planetFrom) {
      prediction = {
        arrivalTime: timeToText(space.timeToArrive($planetFrom, $planetTo)),
        numSpaceshipsAtArrival: space.numSpaceshipsAtArrival(
          $planetFrom,
          $planetTo
        ),
        outcome: space.outcome($planetFrom, $planetTo, fleetAmount),
      };
    }
  }

  let confirmDisabled = false;
  $: {
    if (planetTo) {
      confirmDisabled = !!(
        $planetTo.state?.natives && !prediction?.outcome.captured
      );
    }
  }

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
    <div class="text-center">
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
    <div class="my-2 bg-cyan-300 border-cyan-300 w-full h-1" />

    {#if planetFrom && planetTo}
      <div class="flex flex-col">
        <div class="flex flex-row justify-between">
          <span class="text-green-600">{$planetFrom.stats.name}</span>
          <svg
            class="w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          <span class="text-green-600 text-right">{$planetTo.stats.name}</span>
        </div>

        <div class="flex flex-row justify-between mt-2 text-xs text-gray-500">
          <span>Spaceships</span><span class="text-right">Spaceships</span>
        </div>
        <div class="flex flex-row justify-between">
          <span>{$planetFrom.state?.numSpaceships}</span><span
            class="text-right">{$planetTo.state?.numSpaceships}</span>
        </div>

        {#if $planetFrom.state?.owner !== $planetTo.state?.owner}
          <div class="flex flex-row justify-between mt-2 text-xs text-gray-500">
            <span>Attack</span><span class="text-right">Defense</span>
          </div>
          <div class="flex flex-row justify-between">
            <span>{$planetFrom.stats.attack}</span><span
              class="text-right">{$planetTo.stats.defense}</span>
          </div>

          <div class="flex flex-row justify-between mt-2 text-xs text-gray-500">
            <span>Arrives in</span><span class="text-right">Spaceships Then</span>
          </div>
          <div class="flex flex-row justify-between">
            <span>{prediction?.arrivalTime}</span><span
              class="text-right">{prediction?.numSpaceshipsAtArrival}</span>
          </div>

          <div class="flex flex-row  justify-center mt-2 text-xs text-gray-500">
            <span>Predicted outcome at time of arrival</span>
          </div>
          <div class="flex flex-row justify-center">
            {#if prediction?.outcome.captured}
              <span
                class="text-green-600">{prediction?.outcome.numSpaceshipsLeft}
                (captured)</span>
            {:else if $planetTo.state?.natives}
              <span class="text-red-400">{prediction?.outcome.numSpaceshipsLeft}
                (native population resists)</span>
            {:else}
              <span class="text-red-400">{prediction?.outcome.numSpaceshipsLeft}
                (attack failed)</span>
            {/if}
          </div>
        {:else}
          <div class="flex flex-row justify-between mt-2 text-xs text-gray-500">
            <span>Arrives in</span><span class="text-right">Spaceships Then</span>
          </div>
          <div class="flex flex-row justify-between">
            <span>{prediction?.arrivalTime}</span><span
              class="text-right">{(prediction?.numSpaceshipsAtArrival || 0) + fleetAmount}</span>
          </div>
        {/if}
      </div>
      <div class="my-2 bg-cyan-300 border-cyan-300 w-full h-1" />
      <div class="text-center">
        <PanelButton
          class="mt-5"
          label="Fleet Amount"
          disabled={confirmDisabled}
          on:click={() => sendFlow.confirm(fleetAmount)}>
          <p>Confirm</p>
          {#if confirmDisabled}(need higher attack){/if}
        </PanelButton>
      </div>
    {/if}
  </div>
</Modal>
