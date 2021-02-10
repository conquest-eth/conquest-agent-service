<script lang="ts">
  import claimFlow from '../stores/claim';
  import sendFlow from '../stores/send';
  import exitFlow from '../stores/exit';
  import {wallet} from '../stores/wallet';
  import privateAccount from '../stores/privateAccount';
  import {planetAt} from '../stores/planets';

  import PanelButton from './PanelButton.svelte';
  import Blockie from './Blockie.svelte';
  import {locationToXY} from '../common/src';
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

  function exitFrom() {
    exitFlow.exitFrom(locationToXY(location));
    close();
  }

  function connect() {
    privateAccount.login();
  }
</script>

<div
  class="absolute inline-block w-48 bg-gray-900 bg-opacity-80 text-cyan-300 border-2 border-cyan-300 m-4 text-sm">
  <div class="flex m-1">
    <h2 class="flex-auto text-green-500 text-center pt-1 font-bold">
      {$planet.stats.name}
    </h2>
    {#if $planet.state && $planet.state.owner !== '0x0000000000000000000000000000000000000000'}
      <div>
        <Blockie class="flex-auto w-8 h-8 flot" address={$planet.state.owner} />
      </div>
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
            style="width: {Math.floor($planet.stats.stake / 5)}%;" />
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
        This is the attack strength of spaceships sent from this planet.
      </Help>
    </Stat>
    <Stat name="Defense" value={$planet.stats.defense} max={10000} min={3600}>
      <Help class="inline w-4 h-4">
        This is the defense strength of spaceships defending this planet.
      </Help>
    </Stat>
    <Stat name="Speed" value={$planet.stats.speed} max={10000} min={4500}>
      <Help class="inline w-4 h-4">
        This is the speed at which spaceship sent from this planet travels in
        unit per hour.
      </Help>
    </Stat>
  </div>
  <div class="w-full h-1 bg-cyan-300 mt-4 mb-2" />
  <div class="flex flex-col text-center">
    {#if $planet.state}
      {#if $wallet.address}
        {#if $planet.state.capturing}
          Capturing...
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
            <PanelButton label="Attack" class="m-2" on:click={sendTo}>
              <div class="w-20">Attack</div>
            </PanelButton>
          {:else}
            <PanelButton label="Send To" class="m-2" on:click={sendTo}>
              <div class="w-20">Send To</div>
            </PanelButton>
          {/if}
        {:else if wallet.address.toLowerCase() === $planet.state.owner.toLowerCase() && !$planet.state.active}
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
          <PanelButton label="Send To" class="m-2" on:click={sendTo}>
            <div class="w-20">Send To</div>
          </PanelButton>
          <PanelButton label="Send From" class="m-2" on:click={sendFrom}>
            <div class="w-20">Send From</div>
          </PanelButton>
        {:else if $planet.state.owner.toLowerCase() === $wallet.address.toLowerCase()}
          <PanelButton label="Send To" class="m-2" on:click={sendTo}>
            <div class="w-20">Send To</div>
          </PanelButton>
          <PanelButton label="Send From" class="m-2" on:click={sendFrom}>
            <div class="w-20">Send From</div>
          </PanelButton>
          <PanelButton
            label="Exit"
            color="text-red-400"
            borderColor="border-red-400"
            class="m-2"
            on:click={exitFrom}>
            <div class="w-20">Exit</div>
          </PanelButton>
        {:else}
          <PanelButton label="Attack" class="m-2" on:click={sendTo}>
            <div class="w-20">Attack</div>
          </PanelButton>
        {/if}
      {:else}
        <PanelButton label="Connect your wallet" class="m-2" on:click={connect}>
          <div class="w-20">Connect Wallet</div>
        </PanelButton>
      {/if}
    {:else if $planet.loaded}
      {#if $planet.state.capturing}
        Capturing...
      {:else}
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
      {/if}
    {:else}Loading...{/if}

    <div class="w-full mt-2" />
  </div>
</div>
