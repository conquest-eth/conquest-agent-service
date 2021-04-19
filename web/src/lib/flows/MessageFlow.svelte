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
{:else if $messageFlow.step === 'LOADING'}
  <Modal on:close={() => messageFlow.cancel()} on:confirm={() => messageFlow.cancel()}>
    <p class="text-center">Please wait while we load the profile...</p>
  </Modal>
{:else if $messageFlow.step === 'READY'}
  <Modal on:close={() => messageFlow.cancel()} on:confirm={() => messageFlow.cancel()}>
    {#if !$messageFlow.profile}
      <p class="text-center">The user did not provide any information.</p>
      <p class="text-center">
        Find each other on
        <a href="https://discord.gg/Qb4gr2ekfr" target="_blank" rel="noopener" class="underline">discord</a>
      </p>
    {:else}
      {#if $messageFlow.profile.name}
        <p class="text-center">{$messageFlow.profile.name}</p>
      {/if}
      {#if $messageFlow.profile.contact}
        <p class="text-center">{$messageFlow.profile.contact}</p>
      {/if}
    {/if}
  </Modal>
{/if}
