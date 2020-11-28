<script lang="ts">
  import Button from './Button.svelte';
  import {wallet} from '../stores/wallet';
  import privateAccount from '../stores/privateAccount';
  import Blockie from './Blockie.svelte';

  function connect() {
    privateAccount.login();
  }
  function disconnect() {
    wallet.disconnect();
  }
</script>

{#if $wallet.address && $privateAccount.step === 'READY'}
  <span class="flex">
    <Blockie class="w-10 h-10" address={$wallet.address} />
    <Button on:click={disconnect}>Disconnect</Button>
  </span>
{:else}
  <Button on:click={connect}>Connect</Button>
{/if}
