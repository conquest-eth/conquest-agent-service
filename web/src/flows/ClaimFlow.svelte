<script lang="ts">
  import claimFlow from '../stores/claim';
  import Modal from '../components/Modal.svelte';
  import Button from '../components/Button.svelte';

  $: planet = $claimFlow.data?.planet;
  $: location = planet?.location;
  $: stats = planet?.stats;

  let stake = $claimFlow.data?.planet?.stats.stake;
</script>

{#if $claimFlow.step === 'CONNECTING'}
  <!---->
{:else if $claimFlow.step === 'CHOOSE_STAKE'}
  <Modal on:close={() => claimFlow.cancel()}>
    <h2>Claim Planet {location.x},{location.y} for {stats.stake} ZTOKEN</h2>

    <Button label="Stake" on:click={() => claimFlow.confirm()}>Confirm</Button>
  </Modal>
{/if}
