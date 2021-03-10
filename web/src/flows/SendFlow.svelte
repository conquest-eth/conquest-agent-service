<script lang="ts">
  import SendingSpaceships from '../components/SendingSpaceships.svelte';
  import Banner from '../components/Banner.svelte';
  import sendFlow from '../stores/send';
  import Modal from '../components/Modal.svelte';
  import SpaceshipsSent from '../components/SpaceshipsSent.svelte';
  import PanelButton from '../components/PanelButton.svelte';
  import SendPreTransactionMessage from '../components/SendPreTransactionMessage.svelte';

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
  <!-- <SpaceshipsSent /> -->
  <SendingSpaceships />
{:else if $sendFlow.step === 'SUCCESS'}
  <SpaceshipsSent />
{:else if $sendFlow.step === 'TUTORIAL_PRE_TRANSACTION'}
  <SendPreTransactionMessage />
{:else if $sendFlow.step === 'TUTORIAL_PRE_FLEET_AMOUNT'}
  <Modal>
    <p class="mb-3">
      You are getting ready to send your first fleet. In the upcoming screen,
      You'll be able to choose how much spaceships you want to send and see the
      expected outcome once the spaceships reaches the destination.
    </p>
    <p class="mb-3">
      Note though that once confirmed, this is only the first part of the action
      you need to perform in order for the fleet to perform its duties. You'll
      need to make sure the fleet action is resolved once it reaches the
      destination. This 2-step process is to ensure your action remains secret
      to all other players.
    </p>
    <!-- <p class="mb-3">
      To help you, we will offer you to create an event on your calendar. But we
      also provide a mechanism to automatically perform that second action. See
      here.
    </p> -->
    <div class="text-center">
      <PanelButton
        label="OK"
        class="mt-4"
        on:click={() => sendFlow.acknowledgeWelcomingStep1()}>
        OK
      </PanelButton>
    </div>
  </Modal>
{:else if $sendFlow.step === 'CONNECTING'}
  <Modal>Connecting...</Modal>
{:else if $sendFlow.step === 'CREATING_TX'}
  <Modal>Preparing The Transaction...</Modal>
{:else if $sendFlow.step === 'WAITING_TX'}
  <Modal>Please Accept the Transaction...</Modal>
{:else}
  <Modal>...</Modal>
{/if}
