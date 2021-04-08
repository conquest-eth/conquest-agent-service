<script lang="ts">
  import Map from './Map.svelte';
  import ConnectPanel from '$lib/components/ConnectPanel.svelte';

  import claimFlow from '$lib/stores/claim';
  import ClaimFlow from '$lib/flows/ClaimFlow.svelte';
  import sendFlow from '$lib/stores/send';
  import SendFlow from '$lib/flows/SendFlow.svelte';
  import exitFlow from '$lib/stores/exit';
  import ExitFlow from '$lib/flows/ExitFlow.svelte';
  import resolveFlow from '$lib/stores/resolve';
  import ResolveFlow from '$lib/flows/ResolveFlow.svelte';
  import FleetsToResolve from '$lib/components/FleetsToResolve.svelte';
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
