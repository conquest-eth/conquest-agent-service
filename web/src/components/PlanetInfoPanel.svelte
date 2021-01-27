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
  class="absolute inline-block min-w-min bg-gray-900 bg-opacity-80 text-cyan-300 border-2 border-cyan-300">
  <div class="flex m-1">
    <h2 class="flex-auto text-white font-bold">
      Planet
      {$planet.location.x},{$planet.location.y}
    </h2>
    {#if $planet.state && $planet.state.owner !== '0x0000000000000000000000000000000000000000'}
      <div>
        <Blockie class="flex-auto w-8 h-8 flot" address={$planet.state.owner} />
      </div>
    {/if}
  </div>
  <div class="w-full h-1 bg-cyan-300" />

  <div class="m-2">
    {#if $planet.state}
      <!-- if active-->
      <div class="m-1">
        <label for="active">active:</label>
        <span id="active" class="value">{$planet.state.active}</span>
      </div>
      {#if $planet.state.exiting}
        <div class="m-1">
          <label for="exiting">exiting:</label>
          <span id="exiting" class="value">{$planet.state.exitTimeLeft}</span>
        </div>
      {/if}
    {/if}

    <div class="m-1">
      <label for="stake">stake:</label>
      <span id="stake" class="value">{$planet.stats.stake}</span>
    </div>
    <div class="m-1">
      <label for="production">production:</label>
      <span id="production" class="value">{$planet.stats.production}</span>
    </div>
    <div class="m-1">
      <label for="attack">attack:</label>
      <span id="attack" class="value">{$planet.stats.attack}</span>
    </div>
    <div class="m-1">
      <label for="defense">defense:</label>
      <span id="defense" class="value">{$planet.stats.defense}</span>
    </div>
    <div class="m-1">
      <label for="speed">speed:</label>
      <span id="speed" class="value">{$planet.stats.speed}</span>
    </div>
    {#if !$planet.state || $planet.state.natives}
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
    {/if}
  </div>
  <div class="w-full h-1 bg-cyan-300" />
  <div class="flex flex-col text-center">
    {#if $planet.state}
      {#if $wallet.address}
        {#if $planet.state.capturing}
          Capturing...
        {:else if $planet.state.owner === '0x0000000000000000000000000000000000000000'}
          <PanelButton label="Capture" class="m-2 flex-auto" on:click={capture}>
            Capture
          </PanelButton>
          {#if $planet.state.natives}
            <PanelButton label="Attack" class="m-2 flex-auto" on:click={sendTo}>
              Attack
            </PanelButton>
          {:else}
            <PanelButton
              label="Send To"
              class="m-2 flex-auto"
              on:click={sendTo}>
              Send To
            </PanelButton>
          {/if}
        {:else if wallet.address.toLowerCase() === $planet.state.owner.toLowerCase() && !$planet.state.active}
          <PanelButton label="Capture" class="m-2 flex-auto" on:click={capture}>
            Capture
          </PanelButton>
          <PanelButton label="Send To" class="m-2 flex-auto" on:click={sendTo}>
            Send To
          </PanelButton>
        {:else if $planet.state.owner.toLowerCase() === $wallet.address.toLowerCase()}
          <PanelButton label="Send To" class="m-2 flex-auto" on:click={sendTo}>
            Send To
          </PanelButton>
          <PanelButton
            label="Send From"
            class="m-2 flex-auto"
            on:click={sendFrom}>
            Send From
          </PanelButton>
          <PanelButton
            label="Exit"
            color="red-400"
            class="m-2"
            on:click={exitFrom}>
            Exit
          </PanelButton>
        {:else}
          <PanelButton label="Attack" class="m-2 flex-auto" on:click={sendTo}>
            Attack
          </PanelButton>
        {/if}
      {:else}
        <PanelButton
          label="Connect your wallet"
          class="m-2 flex-auto"
          on:click={connect}>
          Connect Wallet
        </PanelButton>
      {/if}
    {:else if $planet.loaded}
      {#if $planet.state.capturing}
        Capturing...
      {:else}
        <PanelButton label="Capture" class="m-2 flex-auto" on:click={capture}>
          Capture
        </PanelButton>
      {/if}
    {:else}Loading...{/if}
  </div>
</div>
