<script lang="ts">
  import Button from './Button.svelte';
  import {flow, wallet} from '../stores/wallet';
  import Blockie from './Blockie.svelte';

  function connect() {
    flow.connect();
  }
  function disconnect() {
    wallet.disconnect();
  }
</script>

{#if $wallet.address}
  <span class="flex">
    <Blockie class="w-10 h-10" address={$wallet.address} />
    <Button on:click={disconnect}>Disconnect</Button>
  </span>
{:else}
  <Button on:click={connect}>Connect</Button>
{/if}
