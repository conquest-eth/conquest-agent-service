<script lang="ts">
  import Modal from '$lib/components/generic/Modal.svelte';
  import type {MyEvent} from '$lib/space/myevents';
  import {account} from '$lib/account/account';
  import {spaceInfo} from '$lib/space/spaceInfo';
  import Button from '$lib/components/generic/PanelButton.svelte';
  import {wallet} from '$lib/blockchain/wallet';
  import Blockie from '../account/Blockie.svelte';

  export let event: MyEvent = null;
  export let isShow;
  let title;

  let fromYou = false;
  let toYou = false;
  let gift = false;
  let attackCaptured = false;

  $: if (event.event) {
    gift = event.event.gift;
    attackCaptured = event.event.won;
    if (event.event.owner.id === $wallet.address.toLowerCase()) {
      fromYou = true;
      if (event.event.gift) {
        if (event.event.destinationOwner.id === event.event.owner.id) {
          toYou = true;
          title = 'Your spaceships landed!';
        } else {
          title = 'Your spaceships arrived to your friend!';
        }
      } else if (event.event.won) {
        title = 'You captured a planet!';
      } else {
        title = 'Your attack did not capture the planet!';
      }
    } else {
      toYou = true;
      if (event.event.gift) {
        title = 'You received some spaceships';
      } else if (event.event.won) {
        title = 'You lost your planet!';
      } else {
        title = 'You got attacked but managed to keep your planet!';
      }
    }
  } else {
    title = 'Void event'; // TODO can it happen ?
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
    {#if toYou && fromYou}
      <!-- TODO add description-->
    {:else if fromYou}
      {#if gift}
        Your {event.event.quantity - event.event.inFlightFleetLoss} spacesships arrived to <Blockie
          class="w-6 h-6 inline-block"
          address={event.event.destinationOwner.id}
        />
      {:else if attackCaptured}
        You managed to capture a planet {#if event.event.destinationOwner.id !== '0x0000000000000000000000000000000000000000'}from
          <Blockie class="w-6 h-6 inline-block" address={event.event.destinationOwner.id} />
        {/if}
      {:else}
        Your attack did not succeed but you killed {event.event.planetLoss} spaceships {#if event.event.destinationOwner.id !== '0x0000000000000000000000000000000000000000'}from
          <Blockie class="w-6 h-6 inline-block" address={event.event.destinationOwner.id} />{/if}
      {/if}
    {:else if gift}
      <Blockie class="w-6 h-6 inline-block" address={event.event.destinationOwner.id} /> sent you {event.event
        .quantity - event.event.inFlightFleetLoss}
      spacesships
    {:else if attackCaptured}
      <p><Blockie class="w-6 h-6 inline-block" address={event.event.destinationOwner.id} /> captured your planet!</p>
      <p>The fleet had {event.event.quantity - event.event.inFlightFleetLoss} spaceships</p>
    {:else}
      <p>
        <Blockie class="w-6 h-6 inline-block" address={event.event.owner.id} /> attempted to capture your planet but only
        managed to kill {event.event.planetLoss} spaceships
      </p>
      <p>The fleet had {event.event.quantity - event.event.inFlightFleetLoss} spaceships and planet had {event.event.planetLoss + event.}</p>
    {/if}
    {#if event.event}
      <ul class="mt-10 text-white">
        <li>From planet: {spaceInfo.getPlanetInfoViaId(event.event.from.id).stats.name}</li>
        <li>To planet: {spaceInfo.getPlanetInfoViaId(event.event.planet.id).stats.name}</li>
        {#if event.event.inFlightFleetLoss > 0}
          <!-- TODO add text to explain this-->
          <li>In flight fleet loss: {event.event.inFlightFleetLoss}</li>
        {/if}
        {#if event.event.inFlightPlanetLoss > 0}
          <!-- TODO add text to explain this-->
          <li>In flight planet loss: {event.event.inFlightPlanetLoss}</li>
        {/if}
        <!-- <li>New spaceships: {event.event.newNumspaceships}</li> do not want to display that as it is stale -->
        <!-- <li>Planet loss: {event.event.planetLoss}</li>
        <li>Fleet loss: {event.event.fleetLoss}</li>
        <li>Quantity: {event.event.quantity}</li> -->
      </ul>
    {:else}
      Void Event <!-- TODO is that possible ?-->
    {/if}

    <div class="text-center">
      <Button class="mt-4 text-center" label="Retry" on:click={acknowledge}>Ok</Button>
    </div>
  </Modal>
{/if}
