<script lang="ts">
  import Modal from '$lib/components/Modal.svelte';
  import PanelButton from '$lib/components/PanelButton.svelte';
  import messageFlow from '$lib/stores/message';
</script>

{#if $messageFlow.error}
  <Modal on:close={() => messageFlow.acknownledgeError()}>
    <div class="text-center">
      <h2>An error happenned</h2>
      <p class="text-gray-300 mt-2 text-sm">{$messageFlow.error.message || $messageFlow.error}</p>
      <PanelButton class="mt-5" label="Stake" on:click={() => messageFlow.acknownledgeError()}>Ok</PanelButton>
    </div>
  </Modal>
{:else if $messageFlow.step === 'SHOW'}
  <Modal on:close={() => messageFlow.cancel()} on:confirm={() => messageFlow.cancel()}>
    <p class="text-center">
      This feature is in progress. Here you'll be able to see how to reach out to other players. We might also implement
      a basic inbox system but we would like to ensure it is decentralised.
    </p>
    <!-- <p class="text-center">
      <PanelButton class="mt-5" label="Exit" on:click={() => exitFlow.confirm()}>Confirm Exit</PanelButton>
    </p> -->
  </Modal>
{/if}
