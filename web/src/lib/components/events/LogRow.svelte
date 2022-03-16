<script lang="ts">
  import Blockie from '$lib/components/account/Blockie.svelte';
  import Coord from '$lib/components/utils/Coord.svelte';
  import {spaceInfo} from '$lib/space/spaceInfo';
  import type {GenericEvent} from '$lib/space/subgraphTypes';
  import {time} from '$lib/time';

  import {timeToText} from '$lib/utils';
  import {BigNumber} from '@ethersproject/bignumber';
  import type {PlanetInfo} from 'conquest-eth-common';
  import PlayCoin from '../utils/PlayCoin.svelte';

  export let event: GenericEvent;

  export let onlySender: boolean = true;
  export let filterAddress: string | undefined = undefined;
  export let filterType: string | undefined = undefined;
  export let filterOrigin: string | undefined = undefined;
  export let filterDestination: string | undefined = undefined;

  function formatStake(stake: string): number {
    return BigNumber.from(stake).div('1000000000000000000').toNumber();
  }

  let color: string;
  let type: string;
  let sender: string;
  let owner: string | undefined;
  let originStr: string | undefined;
  let origin: PlanetInfo | undefined;
  let destinationStr: string | undefined;
  let destination: PlanetInfo | undefined;
  let destinationOwner: string | undefined;
  let quantity: {type: 'Stake' | 'Spaceships'; amount: number} | undefined;
  let outcome:
    | {
        stake?: number;
        winner?: string;
        description: string | string[];
        captured?: boolean;
      }
    | undefined;
  $: {
    sender = event.owner.id;
    color = 'text-gray-100';
    destination = undefined;
    destinationOwner = undefined;
    origin = undefined;
    originStr = undefined;
    quantity = undefined;
    if (event.__typename === 'PlanetStakeEvent') {
      color = 'text-blue-400';
      origin = spaceInfo.getPlanetInfoViaId(event.planet.id);
      type = 'Stake';
      quantity = {
        type: 'Stake',
        amount: origin.stats.stake,
      };
      outcome = {
        winner: undefined,
        stake: origin.stats.stake,
        description: 'Planet is now active',
      };
    } else if (event.__typename === 'PlanetExitEvent') {
      origin = spaceInfo.getPlanetInfoViaId(event.planet.id);
      color = 'text-yellow-400';
      type = 'Exiting';
      quantity = {
        type: 'Stake',
        amount: origin.stats.stake,
      };
      const timePassedSinceExit = $time - parseInt(event.exitTime);
      outcome = {
        winner: undefined,
        stake: origin.stats.stake,
        description: event.interupted
          ? 'Planet Exit was interrupted'
          : timePassedSinceExit > spaceInfo.exitDuration
          ? 'Planet Exited, No More Active'
          : 'Planet is exiting in ' + timeToText(spaceInfo.exitDuration - timePassedSinceExit),
      };
    } else if (event.__typename === 'FleetSentEvent') {
      origin = spaceInfo.getPlanetInfoViaId(event.planet.id);
      type = 'Sending Fleet';
      quantity = {
        type: 'Spaceships',
        amount: parseInt(event.quantity),
      };
      outcome = {
        winner: undefined,
        stake: undefined,
        description: `${quantity.amount} spaceships on their way`,
      };
    } else if (event.__typename === 'FleetArrivedEvent') {
      origin = spaceInfo.getPlanetInfoViaId(event.from.id);
      destination = spaceInfo.getPlanetInfoViaId(event.planet.id);
      // owner = event.fl; // TODO
      destinationOwner =
        event.destinationOwner.id !== '0x0000000000000000000000000000000000000000'
          ? event.destinationOwner.id
          : undefined;
      if (event.gift) {
        type = 'Arrival';
        color = 'text-green-500';
      } else {
        color = 'text-red-400';
        type = 'Battle';
      }
      quantity = {
        type: 'Spaceships',
        amount: parseInt(event.quantity),
      };
      const winner = event.gift ? undefined : event.won ? event.owner.id : event.destinationOwner.id;
      let description: string | string[] = `${quantity.amount - parseInt(event.inFlightFleetLoss)} spaceships arrived`;
      if (!event.gift) {
        description = [
          `The fleet had ${parseInt(event.quantity) - parseInt(event.inFlightFleetLoss)} spaceships`,
          `Planet had ${parseInt(event.planetLoss) + parseInt(event.inFlightPlanetLoss)} spaceships`,
        ];
      }
      outcome = {
        captured: winner && winner !== event.destinationOwner.id,
        winner,
        stake: destinationOwner && event.won ? destination.stats.stake : undefined,
        description,
      };
    } else if (event.__typename === 'TravelingUpkeepReductionFromDestructionEvent') {
      origin = spaceInfo.getPlanetInfoViaId(event.planet.id);
      // destination = spaceInfo.getPlanetInfoViaId(event.planet.id);
      type = 'Upkeep Reduction';
    } else if (event.__typename === 'StakeToWithdrawEvent') {
      // no origin
      type = 'Token To WIthdraw';
    } else if (event.__typename === 'ExitCompleteEvent') {
      origin = spaceInfo.getPlanetInfoViaId(event.planet.id);
      type = 'Exit Complete';
    } else {
      type = 'Unknown';
      console.log(event);
    }
    if (origin) {
      originStr = `${origin.location.x},${origin.location.y}`;
    }
    if (destination) {
      destinationStr = `${destination.location.x},${destination.location.y}`;
    }
  }

  $: filteredIn =
    (!filterAddress || sender == filterAddress.toLowerCase()) &&
    (!filterType || type.toLowerCase().startsWith(filterType.toLowerCase())) &&
    (!filterOrigin || originStr == filterOrigin) &&
    (!filterDestination || destinationStr == filterDestination);
</script>

{#if filteredIn}
  <td class={`whitespace-nowrap py-2 pl-4 pr- text-sm sm:pl-6 ${color} text-center `}>
    {timeToText($time - parseInt(event.timestamp), {compact: true})}
    ago</td
  >
  <td class={`whitespace-nowrap px-2 py-2 text-sm font-medium ${color} text-center `}
    ><Blockie class="ml-2 w-6 h-6 inline my-1/2 mr-2" address={sender} />{#if owner && owner !== sender}
      / <Blockie class="w-6 h-6 inline my-1/2 mr-2" address={owner} />{/if}</td
  >
  <td class={`whitespace-nowrap px-2 py-2 text-sm font-medium ${color} text-center `}>{type}</td>
  <td class={`whitespace-nowrap px-2 py-2 text-sm ${color} text-center `}
    >{#if origin}<Coord location={origin.location.id} />{/if}</td
  >
  <td class={`whitespace-nowrap px-2 py-2 text-sm ${color} text-center `}
    >{#if destination}<Coord location={destination.location.id} />{/if}
    {#if destinationOwner}<Blockie class="w-6 h-6 inline my-1/2 mr-2" address={destinationOwner} />{/if}</td
  >
  <!-- <td class={`whitespace-nowrap px-2 py-2 text-sm ${color} text-center `}
    >{#if quantity}{#if quantity.type === 'Spaceships'}
        {quantity.amount}
      {:else}
        {quantity.amount} <PlayCoin class="w-6 h-6 inline-block" />
      {/if}{/if}</td
  > -->
  {#if outcome}
    {#if outcome.winner}
      <td class={`whitespace-nowrap px-2 py-2 text-sm ${color} text-left `}
        >{#if typeof outcome.description !== 'string'}{#each outcome.description as description}<p>
              {description}
            </p>{/each}{:else}{outcome.description}{/if}</td
      >
      <td class={`whitespace-nowrap px-2 py-2 text-sm ${color} text-left `}
        >{#if outcome.captured}Won{:else}Defended{/if} by <Blockie
          class="w-6 h-6 inline my-1/2 mr-2"
          address={outcome.winner}
        />
        {#if outcome.stake}(Captured: {outcome.stake}
          <PlayCoin class="w-6 h-6 inline-block" />){/if}</td
      >
    {:else if outcome.stake}
      <td class={`whitespace-nowrap px-2 py-2 text-sm ${color} text-left `}
        >{#if typeof outcome.description !== 'string'}{#each outcome.description as description}<p>
              {description}
            </p>{/each}{:else}{outcome.description}{/if}</td
      >
      <td class={`whitespace-nowrap px-2 py-2 text-sm ${color} text-left `}
        >{outcome.stake} <PlayCoin class="w-6 h-6 inline-block" /></td
      >
    {:else}
      <td colspan="2" class={`whitespace-nowrap px-2 py-2 text-sm ${color} text-left `}
        >{#if typeof outcome.description !== 'string'}{#each outcome.description as description}<p>
              {description}
            </p>{/each}{:else}{outcome.description}{/if}</td
      >
    {/if}
  {:else}
    <td colspan="2" class={`whitespace-nowrap px-2 py-2 text-sm ${color} text-left `} />
  {/if}

  <td class="relative whitespace-nowrap py-2 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
    <a
      href={`${import.meta.env.VITE_BLOCK_EXPLORER_TRANSACTION}${event.transaction.id}`}
      target="_blank"
      class="text-indigo-600 hover:text-indigo-100">Transaction</a
    >
  </td>
{/if}
