<script lang="ts">
  import {timeToText} from '$lib//utils';
  import Button from '$lib/components/generic/PanelButton.svelte';
  import PlayCoin from '$lib/components/utils/PlayCoin.svelte';
  import Modal from '$lib/components/generic/Modal.svelte';
  import PanelButton from '$lib/components/generic/PanelButton.svelte';
  import exitFlow from '$lib/flows/exit';
  import {spaceInfo} from '$lib/space/spaceInfo';
  import {planetAt} from '$lib/space/planets';
  import {xyToLocation} from 'conquest-eth-common';

  $: planet = $exitFlow.data?.location
    ? planetAt(xyToLocation($exitFlow.data?.location.x, $exitFlow.data?.location.y))
    : undefined;
</script>

{#if $exitFlow.error}
  <Modal on:close={() => exitFlow.acknownledgeError()}>
    <div class="text-center">
      <h2>An error happenned</h2>
      <p class="text-gray-300 mt-2 text-sm">{$exitFlow.error.message || $exitFlow.error}</p>
      <Button class="mt-5" label="Stake" on:click={() => exitFlow.acknownledgeError()}>Ok</Button>
    </div>
  </Modal>
{:else if $exitFlow.step === 'WAITING_CONFIRMATION'}
  <Modal on:close={() => exitFlow.cancel()} on:confirm={() => exitFlow.confirm()}>
    <p class="text-center">
      Exiting a planet will allow you to claim the stake back ({$planet.stats.stake}
      <PlayCoin class="inline w-4" />
      for this planet). But be careful, while you are exiting (this take
      {timeToText(spaceInfo.exitDuration, {verbose: true})}), you cannot operate with the spaceships and someone else
      might be able to capture the planet before exit complete. Note however that the planet will continue producting
      spaceships for its defense. Upon exit, the number of spaceships will then be zero.
    </p>
    <p class="text-center">
      <PanelButton class="mt-5" label="Exit" on:click={() => exitFlow.confirm()}>Confirm Exit</PanelButton>
    </p>
  </Modal>
{:else}
  <Modal>
    {#if $exitFlow.step === 'SUCCESS'}
      <div class="text-center">
        <p class="pb-4">
          You'll be able to claim back the stake
          {timeToText(spaceInfo.exitDuration, {verbose: true})}
          after the tx is mined
        </p>
        <PanelButton label="OK" on:click={() => exitFlow.acknownledgeSuccess()}>OK</PanelButton>
      </div>
    {:else if $exitFlow.step === 'CONNECTING'}
      Connecting...
    {:else if $exitFlow.step === 'WAITING_TX'}Please Accept the Transaction...{:else}...{/if}
  </Modal>
{/if}
