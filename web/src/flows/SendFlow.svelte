<script lang="ts">
  import Banner from '../components/Banner.svelte';
  import Button from '../components/Button.svelte';
  import Modal from '../components/Modal.svelte';
  import sendFlow from '../stores/send';

  $: pickNeeded =
    $sendFlow.step === 'PICK_DESTINATION'
      ? 'destination'
      : $sendFlow.step === 'PICK_ORIGIN'
      ? 'origin'
      : undefined;

  let fleetAmount = 0;
</script>

{#if pickNeeded}
  <Banner on:close={() => sendFlow.cancel()}>
    <p class="font-medium text-white">
      <span class="inline" />
      {#if pickNeeded === 'destination'}
        Pick the Destination
      {:else}Pick the Origin{/if}
    </p>
  </Banner>
{:else if $sendFlow.step === 'CHOOSE_FLEET_AMOUNT'}
  <Modal
    on:close={() => sendFlow.cancel()}
    on:confirm={() => sendFlow.confirm(fleetAmount)}>
    <!-- <h2 slot="header">Claim Planet {location.x},{location.y}</h2> -->

    <p>How many spaceships?</p>

    <div>
      <!-- TODO show DAI balance and warn when cannot buy // DAI balance could be shown in navbar (once connected)-->
      <input
        type="range"
        id="fleetAmount"
        name="fleetAmount"
        bind:value={fleetAmount} />
      <label for="fleetAmount">Number Of Spaceships</label>
      <input type="text" id="textInput" value={fleetAmount} />
    </div>
    <Button label="Fleet Amount" on:click={() => sendFlow.confirm(fleetAmount)}>
      Confirm
    </Button>
  </Modal>
{/if}
