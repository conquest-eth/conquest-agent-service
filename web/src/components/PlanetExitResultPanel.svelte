<script lang="ts">
  import PanelButton from './PanelButton.svelte';
  import privateAccount from '../stores/privateAccount';
  export let exit: {txHash: string; location: string};
  function deleteExit() {
    privateAccount.deleteExit(exit.location);
  }
</script>

<p class="p-2">The Exit Transaction Failed</p>
<p class="p-2">
  See
  <a
    target="_blank"
    class="underline text-cyan-100"
    href={`${import.meta.env.SNOWPACK_PUBLIC_BLOCK_EXPLORER}/${exit.txHash}`}>here</a>
</p>
<PanelButton
  label="Connect your wallet"
  class="m-2"
  on:click={() => deleteExit()}>
  <div class="w-20">OK</div>
</PanelButton>
