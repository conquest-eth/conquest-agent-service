<script lang="ts">
  import Button from '../components/PanelButton.svelte';
  import NavButton from '../components/navigation/NavButton.svelte';
  import WalletAccess from '../templates/WalletAccess.svelte';
  import {wallet, builtin, flow} from '../stores/wallet';
  import privateAccount from '../stores/privateAccount';
  import {withdrawals} from '../stores/withdrawals';

  withdrawals.loadWithrawableBalance();
</script>

<div class="w-screen h-screen bg-black">
  <NavButton label="Back To Game" href="/">Back To Game</NavButton>

  <br />
  <WalletAccess>
    <div class="flex justify-center flex-wrap text-cyan-300">
      {#if $privateAccount.step !== 'READY'}
        <Button
          class="w-max-content m-4"
          label="connect"
          disabled={!$builtin.available || $wallet.connecting}
          on:click={() => privateAccount.login()}>
          Connect
        </Button>
      {:else if $privateAccount.data && $privateAccount.data.lastWithdrawal}
        <p>withdrawal in progress..</p>
      {:else}
        {#if $withdrawals.state === 'Loading'}
          <p>Please wait...</p>
        {:else}
          <p>
            {$withdrawals.balance.div('10000000000000000').toNumber() / 100}
          </p>
        {/if}
        <Button
          class="w-max-content m-4"
          label="withdraw"
          disabled={$withdrawals.balance.eq(0)}
          on:click={() => withdrawals.withdraw()}>
          withdraw
        </Button>
      {/if}
    </div>
  </WalletAccess>
</div>
