<script lang="ts">
  import type {ExitCompleteEvent, ExternalFleetEvent, InternalFleetEvent, MyEvent} from '$lib/space/myevents';
  import ExitEventInfo from './ExitEventInfo.svelte';
  import FleetEventInfo from './FleetEventInfo.svelte';

  export let event: MyEvent;
  export let okLabel: string = 'OK';
  export let closeButton: boolean;

  $: fleetEvent = event.type === 'external_fleet' || event.type === 'internal_fleet' ? event : undefined;
  $: exitEvent = event.type === 'exit_complete' ? event : undefined;
</script>

{#if fleetEvent}
  <FleetEventInfo event={fleetEvent} {okLabel} {closeButton} on:close />
{:else}
  <ExitEventInfo event={exitEvent} {okLabel} {closeButton} on:close />
{/if}
