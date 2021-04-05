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
<ConnectPanel />
<div class="absolute right-0 top-12">
  <FleetsToResolve />
</div>

{#if $claimFlow.error || $claimFlow.step !== 'IDLE'}
  <ClaimFlow />
{/if}

{#if $sendFlow.error || $sendFlow.step !== 'IDLE'}
  <SendFlow />
{/if}

{#if $resolveFlow.error || $resolveFlow.step !== 'IDLE'}
  <ResolveFlow />
{/if}

{#if $exitFlow.error || $exitFlow.step !== 'IDLE'}
  <ExitFlow />
{/if}
