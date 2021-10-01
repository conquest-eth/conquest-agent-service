<script lang="ts">
  import {base} from '$app/paths';

  import Blockie from '$lib/components/account/Blockie.svelte';
  import NavButton from '$lib/components/navigation/NavButton.svelte';
  import PlayCoin from '$lib/components/utils/PlayCoin.svelte';

  import {highscores} from '$lib/space/highscores';
  import {onMount} from 'svelte';
  onMount(() => {
    highscores.start();
  });
</script>

<div class="w-full h-full bg-black text-white">
  <NavButton label="Back To Game" href={`${base}/`}>Back To Game</NavButton>
  <div class="markdown text-white p-3">
    <h1 class="text-cyan-400"><span class="font-black">Highscores</span></h1>
    <p class="text-gray-400">Note: ties are not resolved here</p>
    <p class="text-gray-400">
      Also note that more token will be given in the coming week based on the initial distribution.
    </p>
    <p class="text-gray-400">Player who received x tokens will receive x tokens more</p>
    <p class="text-gray-400">The score will adjust on reception of these extra tokens.</p>
    <p class="text-gray-400">score = 1000 * (((token in control) - (token given)) / (token given))</p>
    {#if $highscores.error}
      <span class="text-red-600">{$highscores.error}</span>
    {:else if $highscores.step === 'IDLE'}
      <span class="text-yellow-600">Please wait...</span>
    {:else if $highscores.step === 'LOADING'}
      <span class="text-yellow-600">Loading...</span>
    {:else}
      <ul>
        {#each $highscores.data as player}
          <li>
            <Blockie class="w-6 h-6 inline my-1/2 mr-2" address={player.id} />
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
