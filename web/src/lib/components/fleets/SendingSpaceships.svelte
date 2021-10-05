<script lang="ts">
  import PanelButton from '$lib/components/generic/PanelButton.svelte';
  import Modal from '$lib/components/generic/Modal.svelte';
  import sendFlow from '$lib/flows/send';
  import {onMount} from 'svelte';

  import {planets} from '$lib/space/planets';
  import {spaceInfo} from '$lib/space/spaceInfo';

  import {timeToText} from '$lib/utils';
  import {time} from '$lib/time';
  import {url} from '$lib/utils/url';
  import Help from '../utils/Help.svelte';
  import {agentService} from '$lib/account/agentService';
  import {account} from '$lib/account/account';

  $: fromPlanetInfo = spaceInfo.getPlanetInfo($sendFlow.data?.from.x, $sendFlow.data?.from.y);
  $: fromPlanetState = planets.planetStateFor(fromPlanetInfo);

  $: toPlanetInfo = spaceInfo.getPlanetInfo($sendFlow.data?.to.x, $sendFlow.data?.to.y);
  $: toPlanetState = planets.planetStateFor(toPlanetInfo);

  // TODO maxSpaceshipsLoaded and invalid message if maxSpaceships == 0
  let fleetAmountSet = false;
  let fleetAmount = 1;
  let maxSpaceships: number;
  $: {
    maxSpaceships = (fromPlanetState && $fromPlanetState.numSpaceships) || 0;
    if (maxSpaceships > 0 && !fleetAmountSet) {
      // TODO loading
      fleetAmount = Math.floor(maxSpaceships / 2);
      fleetAmountSet = true;
    }
  }

  $: agentServiceAccount = $agentService.account;

  let prediction:
    | {
        arrivalTime: string;
        numSpaceshipsAtArrival: {max: number; min: number};
        outcome: {
          min: {captured: boolean; numSpaceshipsLeft: number};
          max: {captured: boolean; numSpaceshipsLeft: number};
          timeUntilFails: number;
        };
      }
    | undefined = undefined;
  $: {
    if (toPlanetState && fromPlanetState) {
      prediction = {
        arrivalTime: timeToText(spaceInfo.timeToArrive(fromPlanetInfo, toPlanetInfo)),
        numSpaceshipsAtArrival: spaceInfo.numSpaceshipsAtArrival(fromPlanetInfo, toPlanetInfo, $toPlanetState),
        outcome: spaceInfo.outcome(fromPlanetInfo, $fromPlanetState, toPlanetInfo, $toPlanetState, fleetAmount, $time),
      };
    }
  }

  let confirmDisabled = false;
  $: {
    if (toPlanetState) {
      confirmDisabled = !!($toPlanetState.natives && !prediction?.outcome.min.captured);
    }
  }

  let useAgentService = false;
  let gift = false;

  onMount(() => {
    useAgentService = account.isAgentServiceActivatedByDefault();
    fleetAmount = 1;
    fleetAmountSet = false;
  });
</script>

<!-- TODO Remove on:confirm, see button below -->
<Modal on:close={() => sendFlow.cancel()} on:confirm={() => sendFlow.confirm(fleetAmount, gift, useAgentService)}>
  <!-- <h2 slot="header">Capture Planet {location.x},{location.y}</h2> -->

  <div class="text-center">
    <p class="font-bold">How many spaceships?</p>
  </div>
  <div class="my-2 bg-cyan-300 border-cyan-300 w-full h-1" />

  <div>
    <div class="text-center">
      <input type="checkbox" bind:checked={gift} /> gift
      <!-- TODO show Token balance and warn when cannot buy // Token balance could be shown in navbar (once connected)-->
      <input
        class="text-cyan-300 bg-cyan-300"
        type="range"
        id="fleetAmount"
        name="fleetAmount"
        bind:value={fleetAmount}
        min="1"
        max={maxSpaceships}
      />
      <!-- <label for="fleetAmount">Number Of Spaceships</label> -->
      <input class="bg-gray-700 border-cyan-800 border-2" type="text" id="textInput" bind:value={fleetAmount} />
    </div>
    <div class="my-2 bg-cyan-300 border-cyan-300 w-full h-1" />

    {#if fromPlanetInfo && toPlanetInfo}
      <div class="flex flex-col">
        <div class="flex flex-row justify-between">
          <span class="text-green-600">{fromPlanetInfo.stats.name}</span>
          <svg class="w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          <span class="text-green-600 text-right">{toPlanetInfo.stats.name}</span>
        </div>

        <div class="flex flex-row justify-between mt-2 text-xs text-gray-500">
          <span>Spaceships</span><span class="text-right">Spaceships</span>
        </div>
        <div class="flex flex-row justify-between">
          <span>{$fromPlanetState.numSpaceships}</span><span class="text-right">{$toPlanetState.numSpaceships}</span>
        </div>

        {#if $fromPlanetState.owner !== $toPlanetState.owner}
          <div class="flex flex-row justify-between mt-2 text-xs text-gray-500">
            <span>Attack</span><span class="text-right">Defense</span>
          </div>
          <div class="flex flex-row justify-between">
            <span>{fromPlanetInfo.stats.attack}</span><span class="text-right">{toPlanetInfo.stats.defense}</span>
          </div>

          <div class="flex flex-row justify-between mt-2 text-xs text-gray-500">
            <span>Arrives in</span><span class="text-right">Spaceships Then</span>
          </div>
          <div class="flex flex-row justify-between">
            <span>{prediction?.arrivalTime}</span><span class="text-right"
              >{prediction?.numSpaceshipsAtArrival.min}</span
            >
          </div>

          <div class="flex flex-row  justify-center mt-2 text-xs text-gray-500">
            <span>Predicted outcome at time of arrival</span>
          </div>
          <div class="flex flex-row justify-center">
            {#if prediction?.outcome.min.captured}
              <span class="text-green-600">{prediction?.outcome.min.numSpaceshipsLeft} (captured)</span>
            {:else if $toPlanetState.natives}
              <span class="text-red-400">{prediction?.outcome.min.numSpaceshipsLeft} (native population resists)</span>
            {:else}<span class="text-red-400">{prediction?.outcome.min.numSpaceshipsLeft} (attack failed)</span>{/if}
          </div>
          {#if prediction?.outcome.min.captured && prediction?.outcome.timeUntilFails > 0}
            <div class="flex flex-row justify-center">
              <span class="text-red-600">
                attack fails if resolved
                {timeToText(prediction?.outcome.timeUntilFails)}
                late</span
              >
            </div>
          {/if}
        {:else}
          <div class="flex flex-row justify-between mt-2 text-xs text-gray-500">
            <span>Arrives in</span><span class="text-right">Spaceships Then</span>
          </div>
          <div class="flex flex-row justify-between">
            <span>{prediction?.arrivalTime}</span><span class="text-right"
              >{(prediction?.numSpaceshipsAtArrival.min || 0) + fleetAmount}</span
            >
          </div>
        {/if}
      </div>
      <div class="my-2 bg-cyan-300 border-cyan-300 w-full h-1" />

      <label class="flex items-center">
        <input
          type="checkbox"
          class="form-checkbox"
          bind:checked={useAgentService}
          disabled={!agentServiceAccount || agentServiceAccount.requireTopUp}
        />

        <span class={`ml-2${!agentServiceAccount || agentServiceAccount.requireTopUp ? ' opacity-25' : ''}`}
          >submit to agent-service</span
        >
        {#if !agentServiceAccount || agentServiceAccount.requireTopUp}
          <span class="ml-2 text-xs"
            >( Enable <a class="underline" href={url('agent-service/')}>Agent-Service</a>
            <Help class="w-4"
              >The agent-service can resolve the second tx for you. You need to register and top it up first though.</Help
            >)</span
          >
        {/if}
      </label>

      <div class="my-2 bg-cyan-300 border-cyan-300 w-full h-1" />
      <div class="text-center">
        <PanelButton
          class="mt-5"
          label="Fleet Amount"
          disabled={confirmDisabled}
          on:click={() => sendFlow.confirm(fleetAmount, gift, useAgentService)}
        >
          <p>Confirm</p>
          {#if confirmDisabled}(need higher attack){/if}
        </PanelButton>
      </div>
    {/if}
  </div>
</Modal>
