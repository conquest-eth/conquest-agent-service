<script lang="ts">
  import {wallet} from '$lib/blockchain/wallet';

  import Blockie from '$lib/components/account/Blockie.svelte';
  import Coord from '$lib/components/utils/Coord.svelte';
  import {playersQuery} from '$lib/space/playersQuery';
  import {spaceInfo} from '$lib/space/spaceInfo';
  import type {GenericParsedEvent} from '$lib/space/subgraphTypes';
  import {time} from '$lib/time';

  import {timeToText} from '$lib/utils';
  import {BigNumber} from '@ethersproject/bignumber';
  import type {PlanetInfo} from 'conquest-eth-common';
  import PlayCoin from '../utils/PlayCoin.svelte';

  export let event: GenericParsedEvent;

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
    const walletAddress = $wallet.address?.toLowerCase();
    sender = event.owner.id;
    color = 'text-gray-300';
    destination = undefined;
    destinationOwner = undefined;
    origin = undefined;
    originStr = undefined;
    quantity = undefined;
    if (event.__typename === 'PlanetStakeEvent') {
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
      if (!walletAddress) {
        color = 'text-yellow-400';
      } else if (walletAddress === sender) {
        color = 'text-green-400';
      } else {
        color = 'text-yellow-400';
      }
    } else if (event.__typename === 'PlanetExitEvent') {
      origin = spaceInfo.getPlanetInfoViaId(event.planet.id);
      type = 'Exiting';
      quantity = {
        type: 'Stake',
        amount: origin.stats.stake,
      };
      const timePassedSinceExit = $time - event.exitTime;
      outcome = {
        winner: undefined,
        stake: origin.stats.stake,
        description: event.interupted
          ? 'Planet Exit was interrupted'
          : timePassedSinceExit > spaceInfo.exitDuration
          ? 'Planet Exited, No More Active'
          : 'Planet is exiting in ' + timeToText(spaceInfo.exitDuration - timePassedSinceExit),
      };

      const ownerAsPlayer = $playersQuery.data?.players[sender];
      const ally = ownerAsPlayer && ownerAsPlayer.ally;

      if (!walletAddress) {
        if (event.interupted) {
          color = 'text-gray-300';
        } else {
          color = 'text-yellow-400';
        }
      } else if (walletAddress === sender) {
        if (event.interupted) {
          color = 'text-red-400';
        } else {
          color = 'text-green-400';
        }
      } else {
        if (event.interupted) {
          color = ally ? 'text-yellow-400' : 'text-gray-300';
        } else {
          color = ally ? 'text-cyan-400' : 'text-yellow-400';
        }
      }
    } else if (event.__typename === 'FleetSentEvent') {
      sender = event.sender.id;
      owner = event.owner.id;
      origin = spaceInfo.getPlanetInfoViaId(event.planet.id);
      type = 'Sending Fleet';
      quantity = {
        type: 'Spaceships',
        amount: event.quantity,
      };
      outcome = {
        winner: undefined,
        stake: undefined,
        description: `${quantity.amount} spaceships on their way`,
      };

      const ownerAsPlayer = $playersQuery.data?.players[owner];
      const ally = ownerAsPlayer && ownerAsPlayer.ally;
      if (!walletAddress) {
        color = 'text-gray-300';
      } else if (walletAddress === sender) {
        if (walletAddress === event.operator) {
          color = 'text-green-400';
        } else {
          color = 'text-blue-500';
        }
      } else {
        color = ally ? 'text-cyan-400' : 'text-gray-300';
      }
    } else if (event.__typename === 'FleetArrivedEvent') {
      sender = event.sender.id;
      owner = event.owner.id;
      origin = spaceInfo.getPlanetInfoViaId(event.from.id);
      destination = spaceInfo.getPlanetInfoViaId(event.planet.id);
      // owner = event.fl; // TODO
      destinationOwner =
        event.destinationOwner.id !== '0x0000000000000000000000000000000000000000'
          ? event.destinationOwner.id
          : undefined;

      quantity = {
        type: 'Spaceships',
        amount: event.quantity,
      };
      const winner = event.gift ? undefined : event.won ? event.owner.id : event.destinationOwner.id;
      let description: string | string[] = `${quantity.amount - event.inFlightFleetLoss} spaceships arrived`;
      if (!event.gift) {
        description = [
          `The fleet had ${event.quantity - event.inFlightFleetLoss} spaceships`,
          `Planet had ${event.planetLoss + event.inFlightPlanetLoss} spaceships`,
        ];
      }
      outcome = {
        captured: winner && winner !== event.destinationOwner.id,
        winner,
        stake: destinationOwner && event.won ? destination.stats.stake : undefined,
        description,
      };

      const ownerAsPlayer = $playersQuery.data?.players[owner];
      const ally = ownerAsPlayer && ownerAsPlayer.ally;

      const destinationOwnerAsPlayer = $playersQuery.data?.players[destinationOwner];
      const destinationAlly = destinationOwnerAsPlayer && destinationOwnerAsPlayer.ally;

      if (event.gift) {
        type = 'Arrival';
        if (!walletAddress) {
          color = 'text-gray-300';
        } else if (walletAddress === sender) {
          if (walletAddress === event.operator) {
            color = 'text-green-400';
          } else {
            if (walletAddress === destinationOwner) {
              color = 'text-green-400';
            } else {
              color = 'text-blue-500';
            }
          }
        } else {
          color = ally ? 'text-cyan-400' : 'text-gray-300';
        }
      } else {
        type = 'Battle';
        if (!walletAddress) {
          color = 'text-gray-300';
        } else if (walletAddress === owner) {
          if (outcome.captured) {
            color = 'text-green-400';
          } else {
            color = 'text-red-400';
          }
        } else if (walletAddress === sender) {
          if (walletAddress === event.operator) {
            if (outcome.captured) {
              color = 'text-green-400';
            } else {
              color = 'text-red-400';
            }
          } else {
            if (walletAddress === destinationOwner) {
              color = 'text-red-400';
            } else {
              color = 'text-blue-500';
            }
          }
        } else if (walletAddress === destinationOwner) {
          if (outcome.captured) {
            color = 'text-red-400';
          } else {
            color = 'text-green-400';
          }
        } else {
          if (outcome.captured) {
            if (ally && destinationAlly) {
              color = 'text-gray-300';
            } else if (ally) {
              color = 'text-cyan-400';
            } else if (destinationAlly) {
              color = 'text-orange-400';
            } else {
              color = 'text-gray-300';
            }
          } else {
            if (ally && destinationAlly) {
              color = 'text-gray-300';
            } else if (ally) {
              color = 'text-green-400';
            } else if (destinationAlly) {
              color = 'text-green-400';
            } else {
              color = 'text-gray-300';
            }
          }
        }
      }
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
    (!filterAddress ||
      sender == filterAddress.toLowerCase() ||
      owner == filterAddress.toLowerCase() ||
      (!onlySender && (owner === filterAddress.toLowerCase() || destinationOwner === filterAddress.toLowerCase()))) &&
    (!filterType || type.toLowerCase().startsWith(filterType.toLowerCase())) &&
    (!filterOrigin || originStr == filterOrigin) &&
    (!filterDestination || destinationStr == filterDestination);
</script>

{#if filteredIn}
  <td class={`whitespace-nowrap py-2 pl-4 pr- text-sm sm:pl-6 ${color} text-center `}>
    {timeToText($time - event.timestamp, {compact: true})}
    ago</td
  >
  <td class={`whitespace-nowrap px-2 py-2 text-sm font-medium ${color} text-center `}
    ><Blockie class="ml-2 w-6 h-6 inline my-1/2 mr-2" address={sender} />{#if owner && owner !== sender}
      <spam class="text-white">&gt;</spam> <Blockie class="w-6 h-6 inline my-1/2 mr-2" address={owner} />{/if}</td
  >
  <td class={`whitespace-nowrap px-2 py-2 text-sm font-medium ${color} text-center `}>{type}</td>
  <td class={`whitespace-nowrap px-2 py-2 text-sm ${color} text-center `}
    >{#if origin}<p class="mb-1">{origin.stats.name}</p>
      <Coord location={origin.location.id} />{/if}</td
  >
  <td class={`whitespace-nowrap px-2 py-2 text-sm ${color} text-center `}
    >{#if destination}<p>{destination.stats.name}</p>
      <Coord location={destination.location.id} />{/if}
    {#if destinationOwner} <Blockie class="m-1 w-6 h-6 inline my-1/2 mr-2" address={destinationOwner} />{/if}</td
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
    <button on:click class="text-indigo-600 hover:text-indigo-100">Details</button>
  </td>
{/if}
