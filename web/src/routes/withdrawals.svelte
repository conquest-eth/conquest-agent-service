<script lang="ts">
  import Button from '../components/PanelButton.svelte';
  import NavButton from '../components/navigation/NavButton.svelte';
  import WalletAccess from '../templates/WalletAccess.svelte';
  import {wallet, builtin, flow} from '../stores/wallet';
</script>

<div class="w-screen h-screen bg-black">
  <NavButton label="Home" href="/">Home</NavButton>

  <WalletAccess>
    <div class="flex justify-center flex-wrap">
      <Button
        class="w-max-content m-4"
        label="connect"
        disabled={!$builtin.available || $wallet.connecting}
        on:click={() => flow.connect()}>
        connect
      </Button>
    </div>
  </WalletAccess>
</div>
