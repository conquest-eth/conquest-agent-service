<script lang="ts">
  import Modal from '../components/Modal.svelte';
  import PanelButton from '../components/PanelButton.svelte';
  import resolveFlow from '../stores/resolve';
</script>

<Modal>
  {#if $resolveFlow.step === 'SUCCESS'}
    The fleet will resovle if mined in time<br />
    <PanelButton label="OK" on:click={() => resolveFlow.acknownledgeSuccess()}>
      OK
    </PanelButton>
  {:else if $resolveFlow.step === 'CONNECTING'}
    Connecting...
  {:else if $resolveFlow.step === 'CREATING_TX'}
    ...
  {:else if $resolveFlow.step === 'WAITING_TX'}
    Please Accept the Transaction...
  {:else}...{/if}
</Modal>
