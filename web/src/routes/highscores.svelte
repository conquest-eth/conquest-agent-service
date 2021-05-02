<script lang="ts">
  import {base} from '$app/paths';

  import Blockie from '$lib/components/Blockie.svelte';
  import NavButton from '$lib/components/navigation/NavButton.svelte';
  import PlayCoin from '$lib/components/PlayCoin.svelte';

  import {highscores} from '$lib/stores/highscores';
  import {BigNumber} from '@ethersproject/bignumber';
  import {onMount} from 'svelte';
  onMount(() => {
    highscores.start();
  });
</script>

<div class="w-full h-full bg-black text-white">
  <NavButton label="Back To Game" href={`${base}/`}>Back To Game</NavButton>
  <div class="markdown text-white p-3">
    <h1><span class="font-black">Highscores</span> (note: ties are not resolved here)</h1>
    {#if $highscores.error}
      {$highscores.error}
    {:else if $highscores.step === 'IDLE'}
      Please wait...
    {:else if $highscores.step === 'LOADING'}
      Loading...
    {:else}
      <ul>
        {#each $highscores.data as player}
          <li>
            <Blockie class="w-6 h-6 inline my-1/2 mr-2" address={player.id} />
            {Math.floor(player.score / 100)}
            <!-- ({player.score / 1000000}) -->
            with
            {player.total}
            <PlayCoin class="w-4 h-4 inline" />
            in control, including
            {player.playTokenBalance}
            <PlayCoin class="w-4 h-4 inline" />
            left to spend and
            {player.playTokenToWithdraw}
            <PlayCoin class="w-4 h-4 inline" />
            to withdraw (was given
            {player.playTokenGiven}
            <PlayCoin class="w-4 h-4 inline" />)
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
