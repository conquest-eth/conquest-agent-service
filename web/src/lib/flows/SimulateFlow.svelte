<script lang="ts">
  import Button from '$lib/components/PanelButton.svelte';
  import Banner from '$lib/components/Banner.svelte';
  import simulateFlow from '$lib/stores/simulateFlow';
  import Modal from '$lib/components/Modal.svelte';
  import SimulateSpaceships from '$lib/components/SimulateSpaceships.svelte';
</script>

{#if $simulateFlow.error}
  <Modal on:close={() => simulateFlow.acknownledgeError()}>
    <div class="text-center">
      <h2>An error happenned</h2>
      <p class="text-gray-300 mt-2 text-sm">{$simulateFlow.error.message || $simulateFlow.error}</p>
      <Button class="mt-5" label="Stake" on:click={() => simulateFlow.acknownledgeError()}>Ok</Button>
    </div>
  </Modal>
{:else if $simulateFlow.step === 'PICK_DESTINATION'}
  <Banner on:close={() => simulateFlow.cancel()}>
    <p class="font-medium"><span class="inline" /> Pick the Destination</p>
  </Banner>
{:else if $simulateFlow.step === 'SIMULATE'}
  <SimulateSpaceships />
{:else}
  <Modal>...</Modal>
{/if}
