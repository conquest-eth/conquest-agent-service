<script lang="ts">
  import claimFlow from '$lib/stores/claim';
  import Modal from '$lib/components/Modal.svelte';
  import Button from '$lib/components/PanelButton.svelte';
  import {planetAt} from '$lib/stores/planets';
  import {playTokenAccount} from '$lib/stores/playToken';
  import {BigNumber} from '@ethersproject/bignumber';
  import PlayCoin from '$lib/components/PlayCoin.svelte';
  import {timeToText} from '$lib/utils';
  import {spaceInfo} from '$lib/app/mapState';

  $: location = $claimFlow.data?.location;
  $: planet = location ? planetAt(location) : undefined;
  $: stats = planet ? $planet.stats : undefined;
  $: stake = stats && stats.stake;
  $: cost = planet ? BigNumber.from($planet.stats.stake) : undefined; // TODO multiplier from config/contract
</script>

{#if $claimFlow.error}
  <Modal on:close={() => claimFlow.acknownledgeError()}>
    <div class="text-center">
      <h2>An error happenned</h2>
      <p class="text-gray-300 mt-2 text-sm">{$claimFlow.error.message || $claimFlow.error}</p>
      <Button class="mt-5" label="Stake" on:click={() => claimFlow.acknownledgeError()}>Ok</Button>
    </div>
  </Modal>
{:else if $claimFlow.step === 'CONNECTING'}
  <!---->
{:else if $claimFlow.step === 'CHOOSE_STAKE'}
  <Modal on:close={() => claimFlow.cancel()}>
    {#if $playTokenAccount.status === 'Idle'}
      Please wait...
    {:else if $playTokenAccount.status === 'WaitingContracts'}
      Please wait...
    {:else if $playTokenAccount.status === 'Ready'}
      {#if !$playTokenAccount.balance}
        Fetching Balance...
      {:else if $playTokenAccount.balance.eq(0)}
        You do not have any
        <PlayCoin class="inline w-4" />. You need
        {cost.toString()}
        <PlayCoin class="inline w-4" />. If you have never got any token, please register on
        <a href="https://conquest.eth.link" class="underline" target="_blank" rel="noopener">conquest.eth website</a>.
      {:else if $playTokenAccount.balance.lt(cost.mul('1000000000000000000'))}
        Not enough
        <PlayCoin class="inline w-4" />. You need
        <span class="text-yellow-400">{cost.toString()}</span>
        <PlayCoin class="inline w-4" />
        but you have only
        <span class="text-yellow-400">{$playTokenAccount.balance.div('1000000000000000000').toString()}</span>
      {:else}
        <div class="text-center">
          <h2>
            Stake
            <span class="text-yellow-500">{stake}
              <PlayCoin class="inline w-4" /></span>
            to capute Planet
            <span class="text-green-500">"{$planet.stats.name}"</span>.
          </h2>
          <p class="text-gray-300 mt-2 text-sm">
            You'll be able to get your stake back if you manage to exit the planet safely (this takes
            {timeToText(spaceInfo.exitDuration, {verbose: true})}).
          </p>
          <Button class="mt-5" label="Stake" on:click={() => claimFlow.confirm()}>Confirm</Button>
        </div>
      {/if}
    {/if}
  </Modal>
{/if}
