<script lang="ts">
  import SendingSpaceships from '../components/SendingSpaceships.svelte';
  import Banner from '../components/Banner.svelte';
  import sendFlow from '../stores/send';
  import Modal from '../components/Modal.svelte';
  import SpaceshipsSent from '../components/SpaceshipsSent.svelte';
  $: pickNeeded =
    $sendFlow.step === 'PICK_DESTINATION'
      ? 'destination'
      : $sendFlow.step === 'PICK_ORIGIN'
      ? 'origin'
      : undefined;
</script>

{#if pickNeeded}
  <Banner on:close={() => sendFlow.cancel()}>
    <p class="font-medium">
      <span class="inline" />
      {#if pickNeeded === 'destination'}
        Pick the Destination
      {:else}Pick the Origin{/if}
    </p>
  </Banner>
{:else if $sendFlow.step === 'CHOOSE_FLEET_AMOUNT'}
  <SendingSpaceships />
{:else if $sendFlow.step === 'SUCCESS'}
  <SpaceshipsSent/>
{:else if $sendFlow.step === 'CONNECTING'}
<Modal>Connecting...</Modal>
{:else if $sendFlow.step === 'CREATING_TX'}
<Modal>...</Modal>
{:else if $sendFlow.step === 'WAITING_TX'}
<Modal>Please Accept the Transaction...</Modal>
{:else}<Modal>...</Modal>{/if}
