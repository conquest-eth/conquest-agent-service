<script lang="ts">
  import claimFlow from '../stores/claim';
  import Modal from '../components/Modal.svelte';
  import Button from '../components/Button.svelte';
  import {planetAt} from '../stores/planets';

  $: location = $claimFlow.data?.location;
  $: planet = planetAt(location);
  $: stats = $planet.stats;
  $: stake = stats.stake;
</script>

{#if $claimFlow.step === 'CONNECTING'}
  <!---->
{:else if $claimFlow.step === 'CHOOSE_STAKE'}
  <Modal on:close={() => claimFlow.cancel()}>
    <h2>Claim Planet {$planet.location.x},{$planet.location.y} for {stake} ZTOKEN</h2>
    <Button label="Stake" on:click={() => claimFlow.confirm()}>Confirm</Button>
  </Modal>
{/if}
