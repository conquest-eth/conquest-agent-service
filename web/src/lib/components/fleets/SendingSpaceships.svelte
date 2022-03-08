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
  import AttackSendTabButton from './AttackSendTabButton.svelte';
  import {playersQuery} from '$lib/space/playersQuery';
  import Blockie from '../account/Blockie.svelte';
  import {wallet} from '$lib/blockchain/wallet';
  import Flatpickr from '../flatpickr/Flatpickr.svelte';
  import confirmDatePlugin from 'flatpickr/dist/plugins/confirmDate/confirmDate.js';

  let useAgentService = false;
  let gift = false;

  let fleetOwnerSpecified;
  let arrivalTimeWanted: Date;
  let formatted_arrivalTimeWanted: string;

  function handleArrivalTimeWantedChange(event: CustomEvent) {
    // const value = event.detail[0][0];
    // if (value) {
    //   console.log({arrivalTimeWanted: value.getTime()});
    //   console.log(value);

    //   // arrivalTimeWanted = new Date(Math.ceil(value.getTime() / 60000) * 60000);
    //   // console.log({arrivalTimeWanted: arrivalTimeWanted.getTime()});
    //   // console.log(arrivalTimeWanted);
    //   // formatted_arrivalTimeWanted = arrivalTimeWanted.toDateString();

    // }
  }

  // TODO investigate why there is need to check sendFlow.data.from ? might need to do the same to sendFlow.data.to below
  $: fromPlanetInfo = $sendFlow.data?.from && spaceInfo.getPlanetInfo($sendFlow.data?.from.x, $sendFlow.data?.from.y);
  $: fromPlanetState = fromPlanetInfo && planets.planetStateFor(fromPlanetInfo);

  $: fleetOwner = $sendFlow.data?.config?.fleetOwner || $fromPlanetState?.owner;
  $: fleetSender = $fromPlanetState?.owner;

  $: toPlanetInfo = spaceInfo.getPlanetInfo($sendFlow.data?.to.x, $sendFlow.data?.to.y);
  $: toPlanetState = planets.planetStateFor(toPlanetInfo);

  $: toPlayer = $playersQuery.data?.players[$toPlanetState?.owner?.toLowerCase()];
  $: fromPlayer = $playersQuery.data?.players[fleetOwner.toLowerCase()];
  $: senderPlayer = $playersQuery.data?.players[fleetSender.toLowerCase()];

  $: console.log({fromPlayer, fleetOwner});

  // TODO maxSpaceshipsLoaded and invalid message if maxSpaceships == 0
  let fleetAmountSet = false;
  let fleetAmount = 1;
  let maxSpaceships: number;
  $: {
    maxSpaceships = fromPlanetState
      ? Math.max(0, $fromPlanetState.numSpaceships - ($sendFlow.data?.config?.numSpaceshipsToKeep || 0))
      : 0;

    if ($sendFlow.data?.config?.numSpaceshipsAvailable) {
      maxSpaceships = Math.min(maxSpaceships, $sendFlow.data?.config?.numSpaceshipsAvailable);
    }
    if (maxSpaceships > 0 && !fleetAmountSet) {
      // TODO loading
      fleetAmount = Math.floor(maxSpaceships / 2);
      fleetAmountSet = true;
    }
  }

  $: agentServiceAccount = $agentService.account;

  $: defaultTimeToArrive = spaceInfo.timeToArrive(fromPlanetInfo, toPlanetInfo);
  // $: arrivalTime = $time + defaultTimeToArrive;

  $: currentTimeToArrive = arrivalTimeWanted ? arrivalTimeWanted.getTime() / 1000 - $time : defaultTimeToArrive;

  $: currentTimeToArriveFormatted = timeToText(currentTimeToArrive);

  $: actualDefaultArrivalDateTime = defaultTimeToArrive + $time;

  $: defaultArrivalDateTime = (Math.ceil((defaultTimeToArrive + $time) / 60) * 60 + 1 * 60);

  let attentionRequired : 'TIME_PASSED' | undefined;
  $: {
    if (arrivalTimeWanted && arrivalTimeWanted.getTime() / 1000 < actualDefaultArrivalDateTime) {
      arrivalTimeWanted = undefined
      attentionRequired = 'TIME_PASSED';
    }
  }

  let prediction:
    | {
        numSpaceshipsAtArrival: {max: number; min: number};
        outcome: {
          min: {captured: boolean; numSpaceshipsLeft: number};
          max: {captured: boolean; numSpaceshipsLeft: number};
          allies: boolean;
          taxAllies: boolean;
          giving?: {tax: number; loss: number};
          timeUntilFails: number;
          nativeResist: boolean;
        };
      }
    | undefined = undefined;
  $: {
    if (toPlanetState && fromPlanetState) {
      prediction = {
        numSpaceshipsAtArrival: spaceInfo.numSpaceshipsAtArrival(
          fromPlanetInfo,
          toPlanetInfo,
          $toPlanetState,
          currentTimeToArrive > defaultTimeToArrive
            ? -(arrivalTimeWanted.getTime() / 1000 - $toPlanetState.lastUpdatedSaved)
            : 0
        ),
        outcome: spaceInfo.outcome(
          fromPlanetInfo,
          $fromPlanetState,
          toPlanetInfo,
          $toPlanetState,
          fleetAmount,
          $time,
          currentTimeToArrive > defaultTimeToArrive
            ? -(arrivalTimeWanted.getTime() / 1000 - $toPlanetState.lastUpdatedSaved)
            : 0,
          senderPlayer,
          fromPlayer,
          toPlayer,
          gift
        ),
      };
    }
  }

  $: flatpickrOptions = flatpickrOptions
    ? flatpickrOptions
    : defaultTimeToArrive
    ? {
        enableTime: true,
        minDate: defaultArrivalDateTime * 1000,
        defaultDate: new Date(defaultArrivalDateTime * 1000).toDateString(),
        defaultSecond: 0,
        time_24hr: true,
        minuteIncrement: 1,
        plugins: [
          confirmDatePlugin({
            confirmText: 'OK ',
            showAlways: false,
          }),
        ],
      }
    : undefined;

  // $: {
  //   console.log({
  //     $time,
  //     defaultTimeToArrive,
  //     arrivalTimeWantedString: arrivalTimeWanted?.toISOString(),
  //     currentTimeToArrive,
  //     arrivalTimeWanted: arrivalTimeWanted?.getTime() / 1000,
  //     arrivalTimeWantedDate: arrivalTimeWanted,
  //     minDate: flatpickrOptions?.minDate
  //   })
  // }

  let confirmDisabled = false;
  $: {
    if (toPlanetState) {
      confirmDisabled = prediction?.outcome.nativeResist;
    }
  }

  $: warning =
    !gift && prediction && prediction.outcome.allies
      ? 'You are attacking an ally!'
      : gift && prediction && !prediction.outcome.allies
      ? 'Your are giving spaceship to a potential enemy!'
      : '';

  $: border_color = gift ? 'border-cyan-300' : 'border-red-500';
  $: text_color = gift ? 'text-cyan-300' : 'text-red-500';

  onMount(() => {
    fleetOwnerSpecified = undefined;
    useAgentService = account.isAgentServiceActivatedByDefault();
    fleetAmount = 1;
    fleetAmountSet = false;
    gift = sendFlow.isGift();
  });

  function useSend() {
    if ($toPlanetState.owner) {
      gift = true;
    }
  }

  function useAttack() {
    if (fleetOwner.toLowerCase() != $toPlanetState.owner.toLowerCase()) {
      gift = false;
    }
  }
</script>


{#if attentionRequired}
<Modal {border_color} on:close={() => attentionRequired = undefined}>
  <div class="text-center">
    <p class="pb-4">Popup Idle, please review information</p>
    <PanelButton label="OK" on:click={() => attentionRequired = undefined}>OK</PanelButton>
  </div>
</Modal>

{:else}
  <!-- TODO Remove on:confirm, see button below -->
<Modal {border_color} on:close={() => sendFlow.back()}>
  <!-- <h2 slot="header">Stake on Planet {location.x},{location.y}</h2> -->

  <nav class="relative z-0 mb-5 rounded-lg shadow flex divide-x divide-gray-700" aria-label="Tabs">
    <!-- Current: "text-gray-900", Default: "text-gray-500 hover:text-gray-700" -->
    <AttackSendTabButton disabled={fleetOwner === $toPlanetState.owner} active={!gift} on:click={useAttack}
      >Attack</AttackSendTabButton
    >
    <AttackSendTabButton active={gift} on:click={useSend}>Give</AttackSendTabButton>
  </nav>
  {#if warning}
    <div class="text-center text-yellow-600">
      {warning}
    </div>
  {/if}
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
        max={maxSpaceships}
      />
      <!-- <label for="fleetAmount">Number Of Spaceships</label> -->
      <input class="bg-gray-700 border-cyan-800 border-2" type="text" id="textInput" bind:value={fleetAmount} />
    </div>
    <div class="my-2 bg-cyan-300 border-cyan-300 w-full h-1" />

    <div class="text-center">
      {#if flatpickrOptions}
        <!-- {new Date(arrivalTimeWanted).getTime() / 1000} -->
        <Flatpickr
          class="bg-gray-800 text-cyan-500"
          options={flatpickrOptions}
          bind:value={arrivalTimeWanted}
          bind:formattedValue={formatted_arrivalTimeWanted}
          on:change={handleArrivalTimeWantedChange}
          name="arrivalTimeWanted"
          placeholder="Arrival Time"
        />
      {/if}
    </div>
    <div class="my-2 bg-cyan-300 border-cyan-300 w-full h-1" />

    {#if !gift}
      {#if !$sendFlow.data?.config?.fleetOwner}
        <div class="text-center">
          Fleet Owner
          <input
            class="text-cyan-300 bg-black"
            type="text"
            id="fleetOwnerSpecified"
            name="fleetOwnerSpecified"
            bind:value={fleetOwnerSpecified}
          />
        </div>
      {:else if $sendFlow.data?.config?.fleetOwner.toLowerCase() === $wallet.address.toLowerCase()}
        <!-- for you -->
      {:else}
        <div class="text-center mb-2">
          sending as : <Blockie class="inline-block w-8 h-8" address={$sendFlow.data?.config?.fleetOwner} />
        </div>
      {/if}
    {/if}

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

        {#if !gift}
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
            <span>{currentTimeToArriveFormatted}</span><span class="text-right"
              >{prediction?.numSpaceshipsAtArrival.min}</span
            >
          </div>

          <div class="flex flex-row  justify-center mt-2 text-xs text-gray-500">
            <span>Predicted outcome at time of arrival</span>
          </div>
          <div class="flex flex-row justify-center">
            {#if prediction?.outcome.min.captured}
              <span class="text-green-600">{prediction?.outcome.min.numSpaceshipsLeft} (captured)</span>
            {:else if prediction?.outcome.nativeResist}
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
          <div class="flex flex-row justify-center">
            <span
              >will receive {fleetAmount - prediction?.outcome.giving?.loss}
              {#if prediction?.outcome.giving?.loss > 0}
                <span class="text-red-500"
                  >{`( ${fleetAmount} - ${prediction?.outcome.giving?.loss} (${
                    prediction?.outcome.giving?.tax / 100
                  }% tax))`}</span
                >
              {/if}
            </span>
          </div>

          <div class="flex flex-row justify-between mt-2 text-xs text-gray-500">
            <span>Arrives in</span><span class="text-right">Spaceships Then</span>
          </div>
          <div class="flex flex-row justify-between">
            <span>{currentTimeToArriveFormatted}</span><span class="text-right"
              >{prediction?.outcome.min.numSpaceshipsLeft || 0}</span
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
          borderColor={border_color}
          color={text_color}
          cornerColor={border_color}
          class="mt-5"
          label="Fleet Amount"
          disabled={confirmDisabled}
          on:click={() =>
            sendFlow.confirm(
              fleetAmount,
              gift,
              useAgentService,
              fleetOwnerSpecified,
              arrivalTimeWanted ? Math.floor(arrivalTimeWanted.getTime() / 1000) : undefined
            )}
        >
          <p>Confirm</p>
          {#if confirmDisabled}(need higher attack){/if}
        </PanelButton>
      </div>
    {/if}
  </div>
</Modal>

{/if}

