<script lang="ts">
  import Modal from '$lib/components/generic/Modal.svelte';
  import type {MyEvent} from '$lib/space/myevents';
  import {account} from '$lib/account/account';
  import {spaceInfo} from '$lib/space/spaceInfo';
  import Button from '$lib/components/generic/PanelButton.svelte';

  export let event: MyEvent = null;
  export let isShow;
  let title;

  $: if (event?.event.won) {
    title = 'You capture a new planet!';
  } else if (event?.event.fleet) {
    title = 'You received a gift!';
  } else if (!event?.event.won) {
    title = "You didn't capture this planet.";
  }
  async function acknowledge() {
    await account.acknowledgeEvent(event);
    event = null;
    isShow = isShow && false;
  }
</script>

{#if isShow}
  <Modal
    {title}
    globalCloseButton={true}
    on:close={() => {
      isShow = false;
      event = null;
    }}
  >
    <ul class="mt-10 text-white">
      {#if event.event.fleet}
        <li>From planet:  {spaceInfo.getPlanetInfoViaId(event.event.planet.id).stats.name} </li>
        <li>Spaceships received: {event.event.quantity}</li>
      {:else}
      <li>Planet: {spaceInfo.getPlanetInfoViaId(event.event.planet.id).stats.name}</li>
      <li>In flight fleet loss: {event.event.inFlightFleetLoss}</li>
      <li>In flight planet loss: {event.event.inFlightPlanetLoss}</li>
      <li>New spaceships: {event.event.newNumspaceships}</li>
      <li>Planet loss: {event.event.planetLoss}</li>
      <li>Fleet loss: {event.event.fleetLoss}</li>
      <li>Quantity: {event.event.quantity}</li>
      {/if}
    </ul>
    <div class="text-center">
      <Button class="mt-4 text-center" label="Retry" on:click={acknowledge}>Ok</Button>
    </div>
  </Modal>
{/if}
