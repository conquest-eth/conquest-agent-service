<script lang="ts">
  import Modal from '$lib/components/generic/Modal.svelte';
  import Button from '$lib/components/generic/PanelButton.svelte';
  import PanelButton from '$lib/components/generic/PanelButton.svelte';
  import resolveFlow from '$lib/flows/resolve';
</script>

{#if $resolveFlow.error}
  <Modal on:close={() => resolveFlow.acknownledgeError()}>
    <div class="text-center">
      <h2>An error happenned</h2>
      <p class="text-gray-300 mt-2 text-sm">{$resolveFlow.error.message || $resolveFlow.error}</p>
      <Button class="mt-5" label="Stake" on:click={() => resolveFlow.acknownledgeError()}>Ok</Button>
    </div>
  </Modal>
{:else}
  <Modal>
    {#if $resolveFlow.step === 'SUCCESS'}
      <div class="text-center">
        <p class="mb-4">The fleet will resolve if mined in time</p>
        <PanelButton label="OK" on:click={() => resolveFlow.acknownledgeSuccess()}>OK</PanelButton>
      </div>
    {:else if $resolveFlow.step === 'CONNECTING'}
      Connecting...
    {:else if $resolveFlow.step === 'CREATING_TX'}
      ...
    {:else if $resolveFlow.step === 'WAITING_TX'}Please Accept the Transaction...{:else}...{/if}
  </Modal>
{/if}
