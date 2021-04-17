<script lang="ts">
  import Button from '$lib/components/PanelButton.svelte';
  import NavButton from '$lib/components/navigation/NavButton.svelte';
  import WalletAccess from '$lib/WalletAccess.svelte';
  import {wallet, builtin, flow} from '$lib/stores/wallet';
  import privateAccount from '$lib/stores/privateAccount';
  import {withdrawals} from '$lib/stores/withdrawals';
  import {onDestroy, onMount} from 'svelte';
  import {base} from '$app/paths';

  onMount(() => {
    withdrawals.loadWithrawableBalance();
  });

  onDestroy(() => {
    withdrawals.stop();
  });
</script>

<div class="w-full h-full bg-black">
  <NavButton label="Back To Game" href={`${base}/`}>Back To Game</NavButton>

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
          <p>{$withdrawals.balance.div('10000000000000000').toNumber() / 100}</p>
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
