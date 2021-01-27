<script lang="ts">
  import Map from './Map.svelte';
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

<Map />
<div class="absolute right-0">
  <ConnectPanel />
</div>
<div class="absolute right-0 top-10">
  <FleetsToResolve />
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
