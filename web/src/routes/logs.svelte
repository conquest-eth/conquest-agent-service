<script lang="ts">
  import {base} from '$app/paths';

  import Blockie from '$lib/components/account/Blockie.svelte';
  import Coord from '$lib/components/utils/Coord.svelte';
  import NavButton from '$lib/components/navigation/NavButton.svelte';
  import PlayCoin from '$lib/components/utils/PlayCoin.svelte';

  import {globalLogs} from '$lib/space/globalLogs';
  import {now, time} from '$lib/time';
  import {timeToText} from '$lib/utils';
  import {BigNumber} from '@ethersproject/bignumber';
  import {onMount} from 'svelte';
  onMount(() => {
    globalLogs.start();
  });

  function formatStake(stake: string): number {
    return BigNumber.from(stake).div('1000000000000000000').toNumber();
  }
</script>

<div class="w-full h-full bg-black text-white">
  <NavButton label="Back To Game" href={`${base}/`}>Back To Game</NavButton>
  <div class="markdown text-white p-3">
    {#if $globalLogs.error}
      {$globalLogs.error}
    {:else if $globalLogs.step === 'IDLE'}
      Please wait...
    {:else if $globalLogs.step === 'LOADING'}
      Loading...
    {:else}
      <div class="flex flex-col">
        <div class="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div class="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
            <div class="shadow overflow-hidden border-b border-cyan-200 sm:rounded-lg">
              <table class="min-w-full divide-y divide-cyan-200">
                <thead class="bg-black-50">
                  <tr>
                    <th
                      scope="col"
                      class="px-6 py-3 text-left text-xs font-medium text-white-500 uppercase tracking-wider">Time</th
                    >
                    <th
                      scope="col"
                      class="px-6 py-3 text-left text-xs font-medium text-white-500 uppercase tracking-wider">User</th
                    >
                    <th
                      scope="col"
                      class="px-6 py-3 text-left text-xs font-medium text-white-500 uppercase tracking-wider">Action</th
                    >
                    <th scope="col" class="relative px-6 py-3"> <span class="sr-only">tx</span></th>
                  </tr>
                </thead>
                <tbody class="bg-black divide-y divide-cyan-200">
                  {#each $globalLogs?.data as event}
                    <tr>
                      {#if event.__typename === 'FleetSentEvent'}
                        <td class="px-6 py-4 whitespace-nowrap">
                          {timeToText($time - parseInt(event.timestamp), {compact: true})}
                          ago
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <Blockie class="w-6 h-6 inline my-1/2 mr-2" address={event.owner.id} />
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          sent
                          {event.quantity}
                          spaceships from
                          <Coord location={event.planet.id} />
                        </td>
                        <!-- {timeToText(now() - event.timestamp)} -->
                        <!-- ago -->
                        <td class="px-6 py-4 whitespace-nowrap">
                          <a
                            href={`${import.meta.env.VITE_BLOCK_EXPLORER_TRANSACTION}${event.transaction.id}`}
                            class="underline">(see tx)</a
                          >
                        </td>
                      {:else if event.__typename === 'FleetArrivedEvent'}
                        <td class="px-6 py-4 whitespace-nowrap">
                          {timeToText($time - parseInt(event.timestamp), {compact: true})}
                          ago
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <Blockie class="w-6 h-6 inline my-1/2 mr-2" address={event.owner.id} />
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          {#if event.destinationOwner.id !== event.owner.id}
                            {#if event.won}
                              <p>
                                fleet from
                                <Coord location={event.from.id} />

                                captured planet
                                <Coord location={event.planet.id} />
                                {#if event.destinationOwner.id !== '0x0000000000000000000000000000000000000000'}
                                  from
                                  <Blockie class="w-6 h-6 inline my-1/2 mr-2" address={event.destinationOwner.id} />
                                {/if}
                              </p>
                              <p>
                                The fleet had {parseInt(event.quantity) - parseInt(event.inFlightFleetLoss)} spaceships
                              </p>
                              <p>
                                Planet had {parseInt(event.planetLoss) + parseInt(event.inFlightPlanetLoss)} spaceships
                              </p>
                            {:else}
                              <p>
                                fleet from
                                <Coord location={event.from.id} />

                                destroyed
                                {event.planetLoss}
                                spaceships from
                                <Blockie class="w-6 h-6 inline my-1/2 mr-2" address={event.destinationOwner.id} />
                                at
                                <Coord location={event.planet.id} />
                              </p>
                              <p>
                                The fleet had {parseInt(event.quantity) - parseInt(event.inFlightFleetLoss)} spaceships
                              </p>
                              <p>
                                Planet had {parseInt(event.newNumspaceships) +
                                  parseInt(event.planetLoss) +
                                  parseInt(event.inFlightPlanetLoss)} spaceships
                              </p>
                            {/if}
                          {:else}
                            <p>
                              fleet from
                              <Coord location={event.from.id} />

                              arrived at
                              <Coord location={event.planet.id} />
                              with
                              {parseInt(event.quantity) - parseInt(event.inFlightFleetLoss)}
                              spaceships
                            </p>
                          {/if}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <!-- {timeToText(now() - event.timestamp)} -->
                          <!-- ago -->
                          <a
                            href={`${import.meta.env.VITE_BLOCK_EXPLORER_TRANSACTION}${event.transaction.id}`}
                            class="underline">(see tx)</a
                          >
                        </td>
                      {:else if event.__typename === 'PlanetExitEvent'}
                        <td class="px-6 py-4 whitespace-nowrap">
                          {timeToText($time - parseInt(event.timestamp), {compact: true})}
                          ago
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <Blockie class="w-6 h-6 inline my-1/2 mr-2" address={event.owner.id} />
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          attempting to exit planet
                          <Coord location={event.planet.id} />
                          with
                          {formatStake(event.stake)}
                          <PlayCoin class="w-4 h-4 inline" />
                          <!-- will complete on
                {timeToText($time - (parseInt(event.exitTime) + spaceInfo.exitDuration))} -->
                          <!-- {timeToText(now() - event.timestamp)} -->
                          <!-- ago -->
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <a
                            href={`${import.meta.env.VITE_BLOCK_EXPLORER_TRANSACTION}${event.transaction.id}`}
                            class="underline">(see tx)</a
                          >
                        </td>
                      {:else if event.__typename === 'PlanetStakeEvent'}
                        <td class="px-6 py-4 whitespace-nowrap">
                          {timeToText($time - parseInt(event.timestamp), {compact: true})}
                          ago
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <Blockie class="w-6 h-6 inline my-1/2 mr-2" address={event.owner.id} />
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          claimed planet
                          <Coord location={event.planet.id} />
                          with
                          {formatStake(event.stake)}
                          <PlayCoin class="w-4 h-4 inline" />
                          <!-- {timeToText(now() - event.timestamp)} -->
                          <!-- ago -->
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <a
                            href={`${import.meta.env.VITE_BLOCK_EXPLORER_TRANSACTION}${event.transaction.id}`}
                            class="underline">(see tx)</a
                          >
                        </td>
                        <!-- {:else if event.__typename === 'StakeToWithdrawEvent'} -->
                        <!-- TODO ?-->
                        <!-- {:else if event.__typename === 'ExitCompleteEvent'} -->
                        <!-- TODO ?-->
                        <!-- {:else if event.__typename === 'RewardToWithdrawEvent'} -->
                        <!-- TODO ?-->
                      {:else}
                        <!-- unknown event -->
                        <!-- <Blockie class="w-6 h-6 inline my-1/2 mr-2" address={event.owner.id} />
                <a
                href={`${import.meta.env.VITE_BLOCK_EXPLORER_TRANSACTION}${event.transaction.id}`}
                class="underline">(see tx)</a> -->
                      {/if}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
