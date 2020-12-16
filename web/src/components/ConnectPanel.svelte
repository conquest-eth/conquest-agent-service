<script lang="ts">
  import PanelButton from './PanelButton.svelte';
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
    <PanelButton class="m-1" label="Disconnect" on:click={disconnect}>
      Disconnect
    </PanelButton>
    <Blockie class="w-10 h-10 m-1" address={$wallet.address} />
  </span>
{:else}
  <PanelButton class="m-1" label="Connect" on:click={connect}>
    Connect
  </PanelButton>
{/if}
