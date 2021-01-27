<script lang="ts">
  import Modal from '../components/Modal.svelte';
  import PanelButton from '../components/PanelButton.svelte';
  import exitFlow from '../stores/exit';
</script>

{#if $exitFlow.step === 'WAITING_CONFIRMATION'}
  <Modal
    on:close={() => exitFlow.cancel()}
    on:confirm={() => exitFlow.confirm()}>
    <PanelButton label="Exit" on:click={() => exitFlow.confirm()}>
      Confirm Exit
    </PanelButton>
  </Modal>
{:else}
  <Modal>
    {#if $exitFlow.step === 'SUCCESS'}
      <div class="text-center">
        <p>You'll be able to claim back the stake 24h after the tx is mined</p>
        <PanelButton label="OK" on:click={() => exitFlow.acknownledgeSuccess()}>
          OK
        </PanelButton>
      </div>
    {:else if $exitFlow.step === 'CONNECTING'}
      Connecting...
    {:else if $exitFlow.step === 'WAITING_TX'}
      Please Accept the Transaction...
    {:else}...{/if}
  </Modal>
{/if}
