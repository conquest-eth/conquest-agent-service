<script lang="ts">
  import claimFlow from '../stores/claim';
  import Modal from '../components/Modal.svelte';
  import Button from '../components/Button.svelte';

  $: planet = $claimFlow.data?.planet;
  $: location = planet?.location;
  $: stats = planet?.stats;

  let stake = $claimFlow.data?.planet?.stats.maxStake;
</script>

{#if $claimFlow.step === 'CONNECTING'}
  <!---->
{:else if $claimFlow.step === 'CHOOSE_STAKE'}
  <Modal
    on:close={() => claimFlow.cancel()}
    on:confirm={() => claimFlow.confirm(stake)}>
    <h2 slot="header">Claim Planet {location.x},{location.y}</h2>

    <p>How much stake?</p>

    <div>
      <!-- TODO show DAI balance and warn when cannot buy // DAI balance could be shown in navbar (once connected)-->
      <input
        type="range"
        id="stake"
        name="stake"
        bind:value={stake}
        min="1"
        max={stats.maxStake} />
      <label for="stake">Stake</label>
      <input type="text" id="textInput" value={stake} />
    </div>
    <Button label="Stake" on:click={() => claimFlow.confirm(stake)}>
      Confirm
    </Button>
  </Modal>
{/if}
