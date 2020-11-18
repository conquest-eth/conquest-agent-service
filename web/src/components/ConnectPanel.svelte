<script lang="ts">
  import Button from './Button.svelte';
  import {wallet} from '../stores/wallet';
  import login from '../stores/login';
  import Blockie from './Blockie.svelte';

  function connect() {
    login.login();
  }
  function disconnect() {
    wallet.disconnect();
  }
</script>

{#if $wallet.address && $login.step === 'READY' }
  <span class="flex">
    <Blockie class="w-10 h-10" address={$wallet.address} />
    <Button on:click={disconnect}>Disconnect</Button>
  </span>
{:else}
  <Button on:click={connect}>Connect</Button>
{/if}
