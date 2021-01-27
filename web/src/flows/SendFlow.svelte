<script lang="ts">
  import SendingSpaceships from '../components/SendingSpaceships.svelte';
  import Banner from '../components/Banner.svelte';
  import sendFlow from '../stores/send';
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
{/if}
