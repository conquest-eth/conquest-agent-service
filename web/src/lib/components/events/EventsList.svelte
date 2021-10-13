<script lang="ts">
  import {myevents} from '$lib/space/myevents';
  import {spaceInfo} from '$lib/space/spaceInfo';
  import type {MyEvent} from '$lib/space/myevents';
  import {camera} from '$lib/map/camera';
  import EventInfo from '$lib/components/events/EventInfo.svelte';
  import {clickOutside} from '$lib/utils/clickOutside';
  import {errors} from '$lib/space/errors';
  import ErrorInfo from './ErrorInfo.svelte';
  import type {SpaceError} from '$lib/space/errors';

  let isToggled = false;
  let isShowInfo = false;
  let selectedEvent: MyEvent;
  let selectedError: SpaceError;

  function onEventSelect(event: MyEvent) {
    selectedEvent = event;
    isShowInfo = true;
  }

  function onErrorSelected(error: SpaceError) {
    selectedError = error;
    isShowInfo = true;
  }
</script>

{#if selectedEvent}
  <EventInfo bind:event={selectedEvent} bind:isShow={isShowInfo} />
{/if}
{#if selectedError}
  <ErrorInfo bind:error={selectedError} bind:isShow={isShowInfo} />
{/if}
<div class="flex-col" use:clickOutside on:click_outside={() => (isToggled = false)}>
  <div
    class="top-0 p-3 w-32 text-center relative bg-gray-900 bg-opacity-80 text-cyan-300 border-2 border-cyan-300 mt-4 text-sm"
  >
    <button on:click={() => (isToggled = !isToggled)} class="text-white md:w-full">
      Events ({$myevents.length + $errors.length})
    </button>
  </div>
  {#if isToggled}
    <div
      class="top-0 text-center  absolute bg-gray-900 bg-opacity-80 text-cyan-300 border-2 border-cyan-300 mt-16 text-sm p-3 "
    >
      {#if $myevents.length || $errors.length}
        <ul class="overflow-auto max-h-32 w-48" style="cursor: pointer;">
          {#each $errors as error}
            <li style="width: 100%" class="text-red-300" on:click={() => onErrorSelected(error)}>
              An error ocured on planet {spaceInfo.getPlanetInfo(error.location.x, error.location.y).stats.name}
            </li>
          {/each}
          {#each $myevents as event}
            {#if event.event.won}
              <li class="text-yellow-300" on:click={() => onEventSelect(event)}>
                You captured {spaceInfo.getPlanetInfoViaId(event.event.planet.id).stats.name}
              </li>
            {:else}
              <li class="text-yellow-300" on:click={() => onEventSelect(event)}>
                You didn't capture {spaceInfo.getPlanetInfoViaId(event.event.planet.id).stats.name}
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
