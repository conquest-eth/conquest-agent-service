<script lang="ts">
  import {base} from '$app/paths';

  import Blockie from '$lib/components/account/Blockie.svelte';
  import NavButton from '$lib/components/navigation/NavButton.svelte';
  import PlayCoin from '$lib/components/utils/PlayCoin.svelte';

  import {highscores} from '$lib/space/highscores';
  import {now, time} from '$lib/time';
  import {timeToText} from '$lib/utils';
  import {onMount} from 'svelte';
  onMount(() => {
    highscores.start();
  });
</script>

<div class="w-full h-full bg-black text-white">
  <NavButton label="Back To Game" href={`${base}/`}>Back To Game</NavButton>
  <div class="markdown text-white p-3">
    <h1 class="text-cyan-400"><span class="font-black">Highscores</span></h1>
    <p class="text-gray-400 text-xs">(Note: ties are not resolved here)</p>
    <p class="text-gray-400">score = 10000 + 10000 * (((token in control) - (token given)) / (token given))</p>
    <p class="text-gray-400">Score will be frozen past December 23rd 10PM UTC</p>
    <p class="text-yellow-400">Time Left: {timeToText(1640296800 - $time)}</p>
    {#if $highscores.error}
      <span class="text-red-600">{$highscores.error}</span>
    {:else if $highscores.step === 'IDLE'}
      <span class="text-yellow-600">Please wait...</span>
    {:else if $highscores.step === 'LOADING'}
      <span class="text-yellow-600">Loading...</span>
    {:else}
      <hr class="my-4" />
      <p>Top 18 Winning players</p>
      <hr class="my-4" />
      <ul>
        {#each $highscores.data.slice(0, 18) as player, index}
          <li>
            <span class="w-10 inline-block">{index + 1}:</span>
            <Blockie class="w-6 h-6 inline my-1/2 mr-2" address={player.id} />
            <div class="w-6 h-6 text-xs mr-4 inline-block" style={`white-space: nowrap;overflow: hidden;`}>
              {player.id}
            </div>
            {Math.floor(player.score / 100)}
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
      <hr class="my-4 mt-16" />
      <p>Non-winning players</p>
      <hr class="my-4" />
      <ul>
        {#each $highscores.data.slice(18) as player, index}
          <li class={player.total == player.playTokenToWithdraw + player.playTokenBalance ? 'text-gray-500' : ''}>
            <span class="w-10 inline-block">{index + 19}:</span>
            <Blockie class="w-6 h-6 inline my-1/2 mr-2" address={player.id} />
            <div class="w-6 h-6 text-xs mr-4 inline-block" style={`white-space: nowrap;overflow: hidden;`}>
              {player.id}
            </div>
            {Math.floor(player.score / 100)}
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
