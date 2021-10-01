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
      <ul>
        {#each $globalLogs.data as event}
          <li>
            {#if event.__typename === 'FleetSentEvent'}
              {timeToText($time - parseInt(event.timestamp), {compact: true})}
              ago
              <Blockie class="w-6 h-6 inline my-1/2 mr-2" address={event.owner.id} />
              sent
              {event.quantity}
              spaceships from
              <Coord location={event.planet.id} />
              <!-- {timeToText(now() - event.timestamp)} -->
              <!-- ago -->
              <a href={`${import.meta.env.VITE_BLOCK_EXPLORER_TRANSACTION}${event.transaction.id}`} class="underline"
                >(see tx)</a
              >
            {:else if event.__typename === 'FleetArrivedEvent'}
              {timeToText($time - parseInt(event.timestamp), {compact: true})}
              ago
              <Blockie class="w-6 h-6 inline my-1/2 mr-2" address={event.owner.id} />
              fleet from
              <Coord location={event.from.id} />

              {#if event.destinationOwner.id !== event.owner.id}
                {#if event.won}
                  captured planet
                  <Coord location={event.planet.id} />
                  {#if event.destinationOwner.id !== '0x0000000000000000000000000000000000000000'}
                    from
                    <Blockie class="w-6 h-6 inline my-1/2 mr-2" address={event.destinationOwner.id} />
                  {/if}
                {:else}
                  destroyed
                  {event.planetLoss}
                  spaceships from
                  <Blockie class="w-6 h-6 inline my-1/2 mr-2" address={event.destinationOwner.id} />
                  at
                  <Coord location={event.planet.id} />
                {/if}
              {:else}
                arrived at
                <Coord location={event.planet.id} />
                with
                {parseInt(event.quantity) - parseInt(event.inFlightFleetLoss)}
                spaceships
              {/if}

              <!-- {timeToText(now() - event.timestamp)} -->
              <!-- ago -->
              <a href={`${import.meta.env.VITE_BLOCK_EXPLORER_TRANSACTION}${event.transaction.id}`} class="underline"
                >(see tx)</a
              >
            {:else if event.__typename === 'PlanetExitEvent'}
              {timeToText($time - parseInt(event.timestamp), {compact: true})}
              ago
              <Blockie class="w-6 h-6 inline my-1/2 mr-2" address={event.owner.id} />
              attempting to exit planet
              <Coord location={event.planet.id} />
              with
              {formatStake(event.stake)}
              <PlayCoin class="w-4 h-4 inline" />
              <!-- will complete on
              {timeToText($time - (parseInt(event.exitTime) + spaceInfo.exitDuration))} -->
              <!-- {timeToText(now() - event.timestamp)} -->
              <!-- ago -->
              <a href={`${import.meta.env.VITE_BLOCK_EXPLORER_TRANSACTION}${event.transaction.id}`} class="underline"
                >(see tx)</a
              >
            {:else if event.__typename === 'PlanetStakeEvent'}
              {timeToText($time - parseInt(event.timestamp), {compact: true})}
              ago
              <Blockie class="w-6 h-6 inline my-1/2 mr-2" address={event.owner.id} />
              claimed planet
              <Coord location={event.planet.id} />
              with
              {formatStake(event.stake)}
              <PlayCoin class="w-4 h-4 inline" />
              <!-- {timeToText(now() - event.timestamp)} -->
              <!-- ago -->
              <a href={`${import.meta.env.VITE_BLOCK_EXPLORER_TRANSACTION}${event.transaction.id}`} class="underline"
                >(see tx)</a
              >
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
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
