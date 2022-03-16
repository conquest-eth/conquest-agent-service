<script lang="ts">
  import type {GenericParsedEvent} from '$lib/space/subgraphTypes';
  import FleetArrivedEventDetails from './specific/FleetArrivedEventDetails.svelte';

  // TODO : remove EventInfo and use EventDetails.svelte instead
  export let event: GenericParsedEvent;
</script>

{#if event.__typename === 'FleetArrivedEvent'}
  <FleetArrivedEventDetails {event} />
{:else}
  <a
    href={`${import.meta.env.VITE_BLOCK_EXPLORER_TRANSACTION}${event.transaction.id}`}
    target="_blank"
    class="text-indigo-600 hover:text-indigo-100">Transaction</a
  >
{/if}
