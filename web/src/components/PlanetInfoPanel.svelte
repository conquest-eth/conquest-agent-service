<script lang="ts">
  import claimFlow from '../stores/claim';
  import sendFlow from '../stores/send';
  import exitFlow from '../stores/exit';
  import {wallet} from '../stores/wallet';
  import privateAccount from '../stores/privateAccount';
  import {planetAt} from '../stores/planets';

  import PanelButton from './PanelButton.svelte';
  import Blockie from './Blockie.svelte';
  import { locationToXY } from 'planet-wars-common';

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
  style=" background-color: #00000077; color: gray; position: absolute; ">
  <!-- <img class="h-16 w-16 rounded-full mx-auto" src="avatar.jpg"> -->
  <div>
    <div class="flex m-1">
      <h2 class="flex-auto text-white font-bold">
        Planet
        {$planet.location.x},{$planet.location.y}
      </h2>
      {#if $planet.state && $planet.state.owner !== "0x0000000000000000000000000000000000000000"}
        <div>
          <Blockie
            class="flex-auto w-8 h-8 flot"
            address={$planet.state.owner} />
        </div>
      {/if}
    </div>

    {#if $planet.state} <!-- if active-->
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
    {#if $planet.state}
      <div class="m-1">
        <label for="numSpaceships">spaceships:</label>
        <span id="numSpaceships" class="value">{$planet.state.numSpaceships}</span>
      </div>
    {:else}
      <div class="m-1">
        <label for="natives">natives:</label>
        <span id="natives" class="value">{$planet.stats.natives}</span>
      </div>
    {/if}
    <div class="flex flex-col">
      {#if $planet.state}
        {#if $wallet.address}
          {#if $planet.state.owner === '0x0000000000000000000000000000000000000000' || (wallet.address.toLowerCase() === $planet.state.owner.toLowerCase() && !$planet.state.active)}
            <PanelButton class="flex-auto" on:click={capture}>
              Capture
            </PanelButton>
            <PanelButton class="m-1 flex-auto" on:click={sendTo}>
              Attack
            </PanelButton>
          {:else if $planet.state.owner.toLowerCase() === $wallet.address.toLowerCase()}
            <PanelButton class="m-1 flex-auto" on:click={sendTo}>
              Send To
            </PanelButton>
            <PanelButton class="m-1 flex-auto" on:click={sendFrom}>
              Send From
            </PanelButton>
            <PanelButton class="m-1 flex-auto" on:click={exitFrom}>
              Exit
            </PanelButton>
          {:else}
            <PanelButton class="m-1 flex-auto" on:click={sendTo}>
              Attack
            </PanelButton>
          {/if}
        {:else}
          <PanelButton class="m-1 flex-auto" on:click={connect}>
            Connect Wallet
          </PanelButton>
        {/if}
      {:else}
        {#if $planet.loaded}
          <PanelButton class="m-1 flex-auto" on:click={capture}>
            Capture
          </PanelButton>
        {:else}
          Loading...
        {/if}
      {/if}
    </div>
  </div>
</div>
