<script lang="ts">
  import claimFlow from '../stores/claim';
  import Modal from '../components/Modal.svelte';
  import Button from '../components/PanelButton.svelte';
  import {planetAt} from '../stores/planets';
  import {playTokenAccount} from '../stores/playToken';
  import {BigNumber} from '@ethersproject/bignumber';
  import PlayCoin from '../components/PlayCoin.svelte';

  $: location = $claimFlow.data?.location;
  $: planet = location ? planetAt(location) : undefined;
  $: stats = planet ? $planet.stats : undefined;
  $: stake = stats && stats.stake;
  $: cost = planet ? BigNumber.from($planet.stats.stake) : undefined; // TODO multiplier from config/contract
</script>

{#if $claimFlow.step === 'CONNECTING'}
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
        <PlayCoin class="inline w-4" />.
      {:else if $playTokenAccount.balance.lt(cost.mul('1000000000000000000'))}
        Not enough
        <PlayCoin class="inline w-4" />. You need
        <span class="text-yellow-400">{cost.toString()}</span>
        <PlayCoin class="inline w-4" />
        but you have only
        <span
          class="text-yellow-400">{$playTokenAccount.balance
            .div('1000000000000000000')
            .toString()}</span>
      {:else}
        <div class="text-center">
          <h2>
            Claim Planet
            <span class="text-green-500">"{$planet.stats.name}"</span>
            for
            <span class="text-yellow-500">{stake}
              <PlayCoin class="inline w-4" /></span>
          </h2>
          <Button
            class="mt-5"
            label="Stake"
            on:click={() => claimFlow.confirm()}>
            Confirm
          </Button>
        </div>
      {/if}
    {/if}
  </Modal>
{/if}
