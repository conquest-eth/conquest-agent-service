<script lang="ts">
  import claimFlow from '../stores/claim';
  import Modal from '../components/Modal.svelte';
  import Button from '../components/PanelButton.svelte';
  import {planetAt} from '../stores/planets';
  import {playTokenAccount} from '../stores/playToken';
  import {BigNumber} from '@ethersproject/bignumber';

  $: location = $claimFlow.data?.location;
  $: planet = location ? planetAt(location) : undefined;
  $: stats = planet ? $planet.stats : undefined;
  $: stake = stats && stats.stake;
  $: cost = planet ? BigNumber.from($planet.stats.stake).mul(5) : undefined; // TODO multiplier from config/contract
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
        You do not have any Play token. You need
        {cost.toString()}
      {:else if $playTokenAccount.balance.lt(cost.mul('1000000000000000000'))}
        Not enough play token. You need
        {cost.toString()}
        Play Token but you have only
        {$playTokenAccount.balance.div('1000000000000000000').toString()}
      {:else}
        <div class="text-center">
          <h2>
            Claim
            <span class="text-green-500">Planet
              {$planet.location.x},{$planet.location.y}</span>
            for
            <span class="text-yellow-500">{stake} Play Token</span>
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
