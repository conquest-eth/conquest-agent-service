<script lang="ts">
  import claimFlow from '../stores/claim';
  import sendFlow from '../stores/send';
  import exitFlow from '../stores/exit';
  import {wallet} from '../stores/wallet';
  import privateAccount from '../stores/privateAccount';
  import {planetAt} from '../stores/planets';

  import PanelButton from './PanelButton.svelte';
  import Blockie from './Blockie.svelte';
  import {locationToXY, xyToLocation} from '../common/src';
  import Stat from './Stat.svelte';
  import PlayCoin from './PlayCoin.svelte';
  import {timeToText} from '../lib/utils';
  import Help from './Help.svelte';

  export let location: string;
  export let close: () => void;

  const planet = planetAt(location);

  function capture() {
    claimFlow.claim(location);
  }

  function sendTo() {
    sendFlow.sendTo(locationToXY(location));
    close();
  }

  function sendFrom() {
    sendFlow.sendFrom(locationToXY(location));
    close();
  }

  function cancelSend() {
    sendFlow.cancel();
  }

  function exitFrom() {
    exitFlow.exitFrom(locationToXY(location));
    close();
  }

  function connect() {
    privateAccount.login();
  }

  $: walletIsOwner =
    $wallet.address &&
    $wallet.address?.toLowerCase() === $planet.state?.owner.toLowerCase();
  $: textColor =
    $planet.state &&
    $planet.state.owner !== '0x0000000000000000000000000000000000000000'
      ? walletIsOwner
        ? 'text-green-500'
        : 'text-red-500'
      : 'text-gray-100';

  $: destinationPlanet =
    $sendFlow.data?.to &&
    planetAt(
      xyToLocation(
        $sendFlow.data?.to.x as number,
        $sendFlow.data?.to.y as number
      )
    );
  $: attacking =
    $sendFlow.step === 'PICK_ORIGIN' &&
    destinationPlanet &&
    $destinationPlanet.state?.owner !== $wallet.address;
</script>

<div
  class="absolute inline-block w-48 bg-gray-900 bg-opacity-80 text-cyan-300 border-2 border-cyan-300 m-4 text-sm">
  <div class="flex m-1">
    {#if $planet.state && $planet.state.owner !== '0x0000000000000000000000000000000000000000'}
      <h2 class={`flex-auto text-center pt-1 font-bold ${textColor}`}>
        {$planet.stats.name}
      </h2>
      <div>
        <Blockie class="flex-auto w-8 h-8 flot" address={$planet.state.owner} />
      </div>
    {:else}
      <h2 class="flex-auto  ${textColor} text-center pt-1 font-bold">
        {$planet.stats.name}
      </h2>
    {/if}
  </div>
  <div class="w-full h-1 bg-cyan-300 my-2" />

  <div class="m-2">
    {#if $planet.state}
      <!-- if active-->
      <!-- <div class="m-1">
        <label for="active">active:</label>
        <span id="active" class="value">{$planet.state.active}</span>
      </div> -->
      {#if $planet.state.exiting}
        <div class="m-1 w-36 flex justify-between text-red-400">
          <p class="p-0 mb-1">Exiting in:</p>
          <p class="p-0 mb-1">{timeToText($planet.state.exitTimeLeft)}</p>
        </div>
      {/if}
    {/if}

    <!-- {#if !$planet.state || $planet.state.natives}
      <div class="m-1">
        <label for="natives">natives:</label>
        <span id="natives" class="value">{$planet.stats.natives}</span>
      </div>
    {:else}
      <div class="m-1">
        <label for="numSpaceships">spaceships:</label>
        <span
          id="numSpaceships"
          class="value">{$planet.state.numSpaceships}</span>
      </div>
    {/if} -->

    <div
      class={'m-1 w-36 flex justify-between' + ($planet.state?.active ? ' text-green-400' : ' text-gray-400')}>
      {#if !$planet.state}
        <p class="p-0 mb-1">loading ...</p>
      {:else if $planet.state.natives}
        <p class="p-0 mb-1">
          Natives
          <Help class="inline w-4 h-4">
            When a planet is not owned by anyone, it has some natives population
            that need to be conquered.
          </Help>
          :
        </p>
        <p class="p-0 mb-1">{$planet.stats.natives}</p>
      {:else}
        <p class="p-0 mb-1">Spaceships:</p>
        <p class="p-0 mb-1">{$planet.state.numSpaceships}</p>
      {/if}
    </div>

    <div class="m-1 w-36 text-yellow-400 ">
      <div class="w-full box-border">
        <p class="p-0 mb-1">
          Stake
          <Help class="inline w-4 h-4">
            This is the amount of
            <PlayCoin class="inline w-4" />
            required to stake to produce spaceships. This is also the amount
            that you (or someone capturing the planet) can withdraw back after
            exiting the planet.
          </Help>
        </p>
        <p class="float-right relative -top-6">
          {$planet.stats.stake}
          <PlayCoin class="inline w-4" />
        </p>
        <div class="box-border rounded-md bg-gray-600">
          <div
            class="w-full h-3 rounded-md bg-yellow-400"
            style="width: {Math.floor($planet.stats.stake)}%;" />
        </div>
      </div>
    </div>
    <Stat
      name="Production"
      value={$planet.stats.production}
      max={12000}
      min={1500}>
      <Help class="inline w-4 h-4">
        This is the rate of spaceship production per hour.
      </Help>
    </Stat>
    <Stat name="Attack" value={$planet.stats.attack} max={10000} min={3600}>
      <Help class="inline w-4 h-4">
        This is the attack strength of spaceships departing from this planet.
      </Help>
    </Stat>
    <Stat name="Defense" value={$planet.stats.defense} max={10000} min={3600}>
      <Help class="inline w-4 h-4">
        This is the defense strength of spaceships defending this planet.
      </Help>
    </Stat>
    <Stat name="Speed" value={$planet.stats.speed} max={10000} min={4500}>
      <Help class="inline w-4 h-4">
        This is the speed at which spaceship departing from this planet travels
        in unit per hour.
      </Help>
    </Stat>
  </div>
  <div class="w-full h-1 bg-cyan-300 mt-4 mb-2" />
  <div class="flex flex-col text-center">
    {#if $planet.state}
      {#if $wallet.address}
        {#if !!$planet.state?.capturing}
          {#if $planet.state.capturing === 'Loading'}
            <p>Please wait....</p>
          {:else if $planet.state.capturing.status === 'Failure'}
            <p>The Transaction Failed.</p>
            <PanelButton
              label="Ok"
              class="m-2"
              color="text-green-500"
              borderColor="border-green-500"
              on:click={() => privateAccount.acknowledgeCaptureFailure($planet.location.id)}>
              <div class="w-20">Ok</div>
            </PanelButton>
          {:else}
            <p>Capturing....</p>
          {/if}
        {:else if $sendFlow.step === 'PICK_DESTINATION'}
          {#if $planet.state.owner === '0x0000000000000000000000000000000000000000'}
            <!-- SEND TO CONQUERE -->
            <PanelButton
              label="Attack!"
              class="m-2"
              color="text-red-500"
              borderColor="border-red-500"
              on:click={sendTo}>
              <div class="w-20">Attack!</div>
            </PanelButton>
          {:else if walletIsOwner && !$planet.state.active}
            <!-- SEND MORE -->
            <PanelButton
              label="Send Hre"
              class="m-2"
              color="text-green-500"
              borderColor="border-green-500"
              on:click={sendTo}>
              <div class="w-20">Send Here</div>
            </PanelButton>
          {:else if walletIsOwner}
            <!-- SEND PROTECTION -->
            <PanelButton
              label="Send To"
              class="m-2"
              color="text-green-500"
              borderColor="border-green-500"
              on:click={sendTo}>
              <div class="w-20">Send Here</div>
            </PanelButton>
          {:else}
            <!-- ATTACK -->
            <PanelButton
              label="Attack!"
              class="m-2"
              color="text-red-500"
              borderColor="border-red-500"
              on:click={sendTo}>
              <div class="w-20">Attack!</div>
            </PanelButton>
          {/if}
          <PanelButton label="Cancel" class="m-2" on:click={cancelSend}>
            <div class="w-20">Cancel</div>
          </PanelButton>
        {:else if $sendFlow.step === 'PICK_ORIGIN'}
          {#if $planet.state.owner === '0x0000000000000000000000000000000000000000'}
            <!-- SEND TO CONQUERE -->
            <p class="m-3">Pick a Planet you own.</p>
          {:else if walletIsOwner && !$planet.state.active}
            <!-- SEND MORE -->
            {#if attacking}
              <PanelButton
                label="Attack From Here"
                class="m-2"
                color="text-red-500"
                borderColor="border-red-500"
                on:click={sendFrom}>
                <div class="w-20">Attack From Here</div>
              </PanelButton>
            {:else}
              <PanelButton
                label="Send From Here"
                class="m-2"
                color="text-green-500"
                borderColor="border-green-500"
                on:click={sendFrom}>
                <div class="w-20">Send From Here</div>
              </PanelButton>
            {/if}
          {:else if walletIsOwner}
            <!-- SEND PROTECTION -->
            {#if attacking}
              <PanelButton
                label="Attack From Here"
                class="m-2"
                color="text-red-500"
                borderColor="border-red-500"
                on:click={sendFrom}>
                <div class="w-20">Attack From Here</div>
              </PanelButton>
            {:else}
              <PanelButton
                label="Send From Here"
                class="m-2"
                color="text-green-500"
                borderColor="border-green-500"
                on:click={sendFrom}>
                <div class="w-20">Send From Here</div>
              </PanelButton>
            {/if}
          {:else}
            <!-- ATTACK -->
            <p class="m-3">Pick a Planet you own.</p>
          {/if}
          <PanelButton label="Cancel" class="m-2" on:click={cancelSend}>
            <div class="w-20">Cancel</div>
          </PanelButton>
        {:else if $planet.state.owner === '0x0000000000000000000000000000000000000000'}
          <PanelButton
            label="Capture"
            class="m-2"
            disabled={!$planet.state.inReach}
            on:click={capture}>
            <div class="w-20">
              Capture
              <span class="text-sm">
                {!$planet.state.inReach ? ' (unreachable)' : ''}</span>
            </div>
          </PanelButton>
          {#if $planet.state.natives}
            <PanelButton
              label="Attack"
              class="m-2"
              color="text-red-500"
              borderColor="border-red-500"
              on:click={sendTo}>
              <div class="w-20">Attack</div>
            </PanelButton>
          {:else}
            <!-- unreachable ? -->
            <PanelButton label="Send Here" class="m-2" on:click={sendTo}>
              <div class="w-20">Send Here</div>
            </PanelButton>
          {/if}
        {:else if walletIsOwner && !$planet.state.active}
          <PanelButton
            label="Capture"
            class="m-2"
            disabled={!$planet.state.inReach}
            on:click={capture}>
            <div class="w-20">
              Capture
              <span class="text-sm">
                {!$planet.state.inReach ? ' (unreachable)' : ''}</span>
            </div>
          </PanelButton>
          <PanelButton label="Send Here" class="m-2" on:click={sendTo}>
            <div class="w-20">Send Here</div>
          </PanelButton>
          <PanelButton label="Send From" class="m-2" on:click={sendFrom}>
            <div class="w-20">Send From</div>
          </PanelButton>
        {:else if walletIsOwner}
          <PanelButton label="Send Here" class="m-2" on:click={sendTo}>
            <div class="w-20">Send Here</div>
          </PanelButton>
          <PanelButton label="Send From" class="m-2" on:click={sendFrom}>
            <div class="w-20">Send From</div>
          </PanelButton>
          <PanelButton
            label="Exit"
            color="text-yellow-400"
            borderColor="border-yellow-400"
            class="m-2"
            on:click={exitFrom}>
            <div class="w-20">Exit</div>
          </PanelButton>
        {:else}
          <PanelButton
            label="Attack"
            class="m-2"
            color="text-red-500"
            borderColor="border-red-500"
            on:click={sendTo}>
            <div class="w-20">Attack</div>
          </PanelButton>
        {/if}
      {:else}
        <PanelButton label="Connect your wallet" class="m-2" on:click={connect}>
          <div class="w-20">Connect Wallet</div>
        </PanelButton>
      {/if}
    {:else}Loading...{/if}

    <div class="w-full mt-2" />
  </div>
</div>
