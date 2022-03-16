<script lang="ts">
  import {base} from '$app/paths';

  import {globalLogs} from '$lib/space/globalLogs';
  import {onMount} from 'svelte';
  import LogRow from '$lib/components/events/LogRow.svelte';
  import NavButton from '$lib/components/navigation/NavButton.svelte';
  import type {GenericParsedEvent} from '$lib/space/subgraphTypes';
  import Modal from '$lib/components/generic/Modal.svelte';
  import EventDetails from '$lib/components/events/EventDetails.svelte';
  onMount(() => {
    globalLogs.start();
  });

  $: logs = $globalLogs?.data ? $globalLogs.data : [];

  let onlySender: boolean = false;
  let filterAddress: string | undefined;
  let filterType: string | undefined;
  let filterOrigin: string | undefined;
  let filterDestination: string | undefined;

  let eventToShowDetails: GenericParsedEvent | undefined;
  function showDetails(event: GenericParsedEvent) {
    eventToShowDetails = event;
  }
  function closeDetals() {
    eventToShowDetails = undefined;
  }
</script>

<div class="px-4 sm:px-6 lg:px-8">
  <div class="sm:flex sm:items-center sticky top-0 bg-black z-10">
    <div class="sm:flex-auto">
      <h1 class="text-xl font-semibold text-gray-100 mt-4">Logs</h1>
      <p class="mt-2 text-sm text-gray-300">
        {#if $globalLogs.error}
          {$globalLogs.error}
        {:else if $globalLogs.step === 'IDLE'}
          Please wait...
        {:else if $globalLogs.step === 'LOADING'}
          Loading...
        {:else}
          Game events
        {/if}
      </p>
    </div>
    <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
      <!-- <button
        type="button"
        class="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
        >Back To Game</button
      > -->
      <NavButton label="Back To Game" href={`${base}/`}>Back To Game</NavButton>
    </div>
  </div>
  <div class="mt-8 flex flex-col">
    <div class="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
      <div class="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
        <div class="overflow-hidden shadow ring-1 ring-white ring-opacity-5 md:rounded-lg">
          <table class="min-w-full divide-y divide-gray-700">
            <thead class="bg-gray-950">
              <tr>
                <th
                  scope="col"
                  class="whitespace-nowrap py-3.5 pl-4 pr-3 text-center text-sm font-semibold text-gray-100 sm:pl-6"
                  >Time</th
                >
                <th scope="col" class="whitespace-nowrap px-2 py-3.5 text-center text-sm font-semibold text-gray-100"
                  >Sender</th
                >
                <th scope="col" class="whitespace-nowrap px-2 py-3.5 text-center text-sm font-semibold text-gray-100"
                  >Type</th
                >
                <th scope="col" class="whitespace-nowrap px-2 py-3.5 text-center text-sm font-semibold text-gray-100"
                  >Origin</th
                >
                <th scope="col" class="whitespace-nowrap px-2 py-3.5 text-center text-sm font-semibold text-gray-100"
                  >Destination</th
                >
                <!-- <th scope="col" class="whitespace-nowrap px-2 py-3.5 text-center text-sm font-semibold text-gray-100"
                  >Quantity</th
                > -->
                <th
                  colspan="2"
                  scope="col"
                  class="whitespace-nowrap px-2 py-3.5 text-left text-sm font-semibold text-gray-100">Outcome</th
                >
                <th scope="col" class="relative whitespace-nowrap text-right py-3.5 pl-3 pr-4 sm:pr-6" />
              </tr>
            </thead>
            <thead class="bg-gray-950">
              <tr>
                <th
                  scope="col"
                  class="whitespace-nowrap py-3.5 pl-4 pr-3 text-right text-sm font-semibold text-gray-500 sm:pl-6"
                  >Filters:</th
                >
                <th scope="col" class="whitespace-nowrap px-2 py-3.5 text-center text-sm font-semibold text-gray-500"
                  ><input
                    type="text"
                    onClick="this.select();"
                    name="filterAddress"
                    class="bg-black text-white ring-1 ring-gray-500 m-2 w-20"
                    bind:value={filterAddress}
                  /><br />
                  <label class="text-xs" for="onlySender">sender only: </label><input
                    class="w-3 h-3"
                    name="onlySender"
                    type="checkbox"
                    bind:checked={onlySender}
                  />
                </th>
                <th scope="col" class="whitespace-nowrap px-2 py-3.5 text-center text-sm font-semibold text-gray-500"
                  ><input
                    type="text"
                    onClick="this.select();"
                    name="filterType"
                    class="bg-black text-white ring-1 ring-gray-500 m-2 w-20"
                    bind:value={filterType}
                  /></th
                >
                <th scope="col" class="whitespace-nowrap px-2 py-3.5 text-center text-sm font-semibold text-gray-500"
                  ><input
                    type="text"
                    onClick="this.select();"
                    name="filterOrigin"
                    class="bg-black text-white ring-1 ring-gray-500 m-2 w-20"
                    bind:value={filterOrigin}
                  /></th
                >
                <th scope="col" class="whitespace-nowrap px-2 py-3.5 text-center text-sm font-semibold text-gray-500"
                  ><input
                    type="text"
                    onClick="this.select();"
                    name="filterDestination"
                    class="bg-black text-white ring-1 ring-gray-500 m-2 w-20"
                    bind:value={filterDestination}
                  /></th
                >
                <!-- <th scope="col" class="whitespace-nowrap px-2 py-3.5 text-center text-sm font-semibold text-gray-500" /> -->
                <th
                  colspan="2"
                  scope="col"
                  class="whitespace-nowrap px-2 py-3.5 text-center text-sm font-semibold text-gray-500"
                />
                <th scope="col" class="relative whitespace-nowrap py-3.5 pl-3 pr-4 sm:pr-6" />
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-800 bg-black">
              {#each logs as event}
                <tr>
                  <LogRow
                    on:click={() => showDetails(event)}
                    {filterType}
                    {filterAddress}
                    {filterDestination}
                    {filterOrigin}
                    {onlySender}
                    {event}
                  />
                </tr>
              {/each}

              <!-- More transactions... -->
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</div>

{#if eventToShowDetails}
  <Modal maxWidth="max-w-screen-xl" on:close={closeDetals}>
    <EventDetails event={eventToShowDetails} />
  </Modal>
{/if}
