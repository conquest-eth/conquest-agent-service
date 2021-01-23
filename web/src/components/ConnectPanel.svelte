<script lang="ts">
  import PanelButton from './PanelButton.svelte';
  import {wallet} from '../stores/wallet';
  import {playTokenAccount} from '../stores/playToken';
  import privateAccount from '../stores/privateAccount';
  import Blockie from './Blockie.svelte';

  function connect() {
    privateAccount.login();
  }
  function disconnect() {
    wallet.disconnect();
  }
  let menu = false;
</script>

{#if $wallet.address && $privateAccount.step === 'READY'}
<div>
  <span class="flex flex-row-reverse" on:click={() => menu= !menu}>
    <Blockie class="w-10 h-10 m-1" address={$wallet.address} />
    {#if $playTokenAccount.balance} <span class="text-yellow-300">{$playTokenAccount.balance.div("10000000000000000").toNumber() / 100}</span> {/if}
  </span>
  {#if menu}
    <PanelButton class="m-1" label="Disconnect" on:click={disconnect}>
      Disconnect
    </PanelButton>
  {/if}
</div>
{:else}
  <PanelButton class="m-1" label="Connect" on:click={connect}>
    Connect
  </PanelButton>
{/if}
