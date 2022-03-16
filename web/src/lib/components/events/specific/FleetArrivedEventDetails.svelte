<script lang="ts">
  import type {FleetArrivedParsedEvent} from '$lib/space/subgraphTypes';

  import {wallet} from '$lib/blockchain/wallet';
  import Blockie from '$lib/components/account/Blockie.svelte';
  import Coord from '$lib/components/utils/Coord.svelte';

  // TODO : remove EventInfo and use EventDetails.svelte instead
  export let event: FleetArrivedParsedEvent;

  let title;

  let fromYou = false;
  let toYou = false;
  let gift = false;
  let attackCaptured = false;

  $: {
    gift = event.gift;
    attackCaptured = event.won;
    if (event.owner.id === $wallet.address.toLowerCase()) {
      fromYou = true;
      if (event.gift) {
        if (event.destinationOwner.id === event.owner.id) {
          toYou = true;
          title = 'Your spaceships landed!';
        } else {
          title = 'Your spaceships arrived!';
        }
      } else if (event.won) {
        title = 'You captured a planet!';
      } else {
        title = 'Your attack failed to capture!';
      }
    } else {
      toYou = true;
      if (event.gift) {
        title = 'You received some spaceships';
      } else if (event.won) {
        title = 'You lost your planet!';
      } else {
        title = 'You got attacked but managed to keep your planet!';
      }
    }
  }
</script>

{#if toYou && fromYou}
  <p>
    Your {event.quantity - event.inFlightFleetLoss} spacesships arrived! from planet <Coord location={event.from.id} />
  </p>
  {#if event.inFlightFleetLoss > 0}
    <p>({event.inFlightFleetLoss} spacesships were destroyed at launch)</p>
  {/if}
{:else if fromYou}
  {#if gift}
    <p>
      Your {event.quantity - event.inFlightFleetLoss} spacesships arrived! from planet <Coord
        location={event.from.id}
      /> to <Blockie class="w-6 h-6 inline-block" address={event.destinationOwner.id} />
    </p>
    {#if event.inFlightFleetLoss > 0}
      <p>({event.inFlightFleetLoss} spacesships were destroyed at launch)</p>
    {/if}
  {:else if attackCaptured}
    <p>
      You captured the planet {#if event.destinationOwner.id !== '0x0000000000000000000000000000000000000000'}from
        <Blockie class="w-6 h-6 inline-block" address={event.destinationOwner.id} />
      {/if} with your fleet of {event.quantity - event.inFlightFleetLoss} spacesships sent from planet <Coord
        location={event.from.id}
      />
    </p>
    {#if event.accumulatedAttackAdded > 0}
      <p>
        The attack was combined with the previous fleet making a total of {event.quantity -
          event.inFlightFleetLoss +
          event.accumulatedAttackAdded} spaceships attacking {event.planetLoss + event.inFlightPlanetLoss}
      </p>
    {/if}

    {#if event.inFlightFleetLoss > 0}
      <p>({event.inFlightFleetLoss} spacesships were destroyed at launch)</p>
    {/if}
  {:else}
    <p>
      Your attack did not succeed but you killed {event.planetLoss + event.inFlightPlanetLoss} spaceships
      {#if event.destinationOwner.id !== '0x0000000000000000000000000000000000000000'}from
        <Blockie class="w-6 h-6 inline-block" address={event.destinationOwner.id} />
      {/if} with your fleet of {event.quantity - event.inFlightFleetLoss} spacesships sent from planet <Coord
        location={event.from.id}
      />. {#if event.inFlightPlanetLoss > 0}
        There was {event.inFlightPlanetLoss} spaceships destroyed in orbit defense
      {/if}
    </p>

    {#if event.accumulatedAttackAdded > 0}
      <p>
        The attack was combined with the previous fleet making a total of {event.quantity -
          event.inFlightFleetLoss +
          event.accumulatedAttackAdded} spaceships attacking
        <!-- TODO get info about total defenses-->
      </p>
    {/if}

    {#if event.inFlightFleetLoss > 0}
      <p>({event.inFlightFleetLoss} spacesships were destroyed at launch)</p>
    {/if}
  {/if}
{:else if gift}
  <p>
    You received {event.quantity - event.inFlightFleetLoss} spacesships by <Blockie
      class="w-6 h-6 inline-block"
      address={event.owner.id}
    /> from planet <Coord location={event.from.id} />.
  </p>
{:else if attackCaptured}
  <p>
    You lost your planet from <Blockie class="w-6 h-6 inline-block" address={event.owner.id} />
  </p>
  <p>
    The fleet had {event.quantity - event.inFlightFleetLoss} spaceships and planet defended with {event.planetLoss +
      event.inFlightPlanetLoss}. {#if event.inFlightPlanetLoss > 0}
      Including {event.inFlightPlanetLoss} spacesships in orbit. (this will be deduced to your traveling fleets)
    {/if}
  </p>

  {#if event.accumulatedAttackAdded > 0}
    <p>
      The attack was combined with the previous fleet making a total of {event.quantity -
        event.inFlightFleetLoss +
        event.accumulatedAttackAdded} spaceships attacking
      <!-- TODO get info about total defenses-->
    </p>
  {/if}
{:else}
  <p>
    Your planet defended succesfully from <Blockie class="w-6 h-6 inline-block" address={event.owner.id} /> but lost
    {event.planetLoss} spaceships.
  </p>
  <p>
    The fleet had {event.quantity - event.inFlightFleetLoss} spaceships and planet defended with {event.planetLoss +
      event.inFlightPlanetLoss}.{#if event.inFlightPlanetLoss > 0}
      Including {event.inFlightPlanetLoss} spacesships in orbit. (this will be deduced to your traveling fleets)
    {/if}
  </p>

  {#if event.accumulatedAttackAdded > 0}
    <p>
      The attack was combined with the previous fleet making a total of {event.quantity -
        event.inFlightFleetLoss +
        event.accumulatedAttackAdded} spaceships attacking {event.planetLoss + event.inFlightPlanetLoss}
    </p>
  {/if}
{/if}
