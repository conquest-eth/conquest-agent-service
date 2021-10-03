<script lang="ts">
  import {myevents} from '$lib/space/myevents';
  import {spaceInfo} from '$lib/space/spaceInfo';
  import type {MyEvent} from '$lib/space/myevents';
  import {camera} from '$lib/map/camera';
  import EventInfo from '$lib/components/events/EventInfo.svelte';
  import {clickOutside} from '$lib/utils/clickOutside';
  import Help from '$lib/components/utils/Help.svelte';

  let isToggled = false;
  let isShowInfo = false;
  let selectedEvent: MyEvent;

  function onEventSelect(event: MyEvent) {
    selectedEvent = event;
    isShowInfo = true;
  }
</script>

{#if isShowInfo}
  <EventInfo event={selectedEvent} bind:isShow={isShowInfo} />
{/if}
<div class="flex-col" use:clickOutside on:click_outside={() => (isToggled = false)}>
  <div
    class="top-0 p-3 w-32 text-center relative bg-gray-900 bg-opacity-80 text-cyan-300 border-2 border-cyan-300 mt-4 text-sm"
  >
    <button on:click={() => (isToggled = !isToggled)} class="text-white md:w-full">
      Events ({$myevents.length})
    </button>
  </div>
  {#if isToggled}
    <div
      class="top-0 text-center absolute bg-gray-900 bg-opacity-80 text-cyan-300 border-2 border-cyan-300 mt-16 text-sm p-3 "
    >
      {#if $myevents.length}
        <ul class="overflow-auto max-h-32" style="cursor: pointer;">
          {#each $myevents as event}
            {#if event.event.won}
              <li class="text-yellow-300" on:click={() => onEventSelect(event)}>
                You captured {event.event.planet.id}
              </li>
            {:else}
              <li class="text-yellow-300" on:click={() => onEventSelect(event)}>
                You didn't capture {event.event.planet}
              </li>
            {/if}
          {/each}
        </ul>
      {:else}
        <h4 style="margin: 10px 0">No events yet</h4>
      {/if}
    </div>
  {/if}
</div>
