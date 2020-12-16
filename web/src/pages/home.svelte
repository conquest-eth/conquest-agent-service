<script lang="ts">
  import Map from '../app/Map.svelte';
  import WalletAccess from '../templates/WalletAccess.svelte';
  import ConnectPanel from '../components/ConnectPanel.svelte';

  import claimFlow from '../stores/claim';
  import ClaimFlow from '../flows/ClaimFlow.svelte';
  import sendFlow from '../stores/send';
  import SendFlow from '../flows/SendFlow.svelte';
  import exitFlow from '../stores/exit';
  import ExitFlow from '../flows/ExitFlow.svelte';
  import resolveFlow from '../stores/resolve';
  import ResolveFlow from '../flows/ResolveFlow.svelte';
  import FleetsToResolve from '../components/FleetsToResolve.svelte';
</script>

<style>
  @keyframes fadeout {
    0% {
      opacity: 1;
    }
    100% {
      display: none;
      visibility: hidden;
      opacity: 0;
    }
  }

  #title {
    animation-name: fadeout;
    animation-duration: 4000ms;
    animation-timing-function: ease-in;
    animation-fill-mode: forwards;
  }
</style>

<WalletAccess>
  <Map />
  <div class="absolute right-0">
    <ConnectPanel />
  </div>
  <div class="absolute right-0 top-10">
    <FleetsToResolve />
  </div>

  <div id="title" style="position: absolute; left: 50%; top: 30%">
    <div
      style="position: relative; left: -50%; top: -30%"
      class="text-5xl  border border-blue-600 text-blue-600 rounded px-4 py-2">
      Planet Wars
    </div>
  </div>

  {#if $claimFlow.step !== 'IDLE'}
    <ClaimFlow />
  {/if}

  {#if $sendFlow.step !== 'IDLE'}
    <SendFlow />
  {/if}

  {#if $resolveFlow.step !== 'IDLE'}
    <ResolveFlow />
  {/if}

  {#if $exitFlow.step !== 'IDLE'}
    <ExitFlow />
  {/if}
</WalletAccess>
