<script lang="ts">
  import Modal from '$lib/components/generic/Modal.svelte';
  import type {SpaceError} from '$lib/space/errors';
  import {account} from '$lib/account/account';
  import {spaceInfo} from '$lib/space/spaceInfo';
  import Button from '$lib/components/generic/PanelButton.svelte';
  import {now} from '$lib/time';

  export let error: SpaceError;
  export let okLabel: string = 'OK';
  export let closeButton: boolean;
  let title;

  $: if (error?.status === 'FAILURE') {
    title = 'Your transaction failed';
  } else if (error?.status === 'CANCELED') {
    title = 'Your transaction was canceled';
  } else if (error?.status === 'TIMEOUT') {
    if (error?.action.type === 'SEND' && error?.action.actualLaunchTime) {
      title = 'Your fleet has not been resolved in time';
    } else {
      title = 'your transaction timed out';
    }
  } else {
    title = 'loading...';
  }

  async function acknowledge() {
    await account.acknowledgeError(error.txHash, null, error.late ? now() : undefined);
  }
</script>

<Modal {title} globalCloseButton={closeButton} cancelable={closeButton} on:close>
  <ul class="mt-10 text-white">
    {#if error.action.type === 'CAPTURE'}
      <li>
        You didn't capture planet {spaceInfo.getPlanetInfo(error.location.x, error.location.y).stats.name} because an error
        ocurred on the
        <a
          target="_blank"
          class="underline text-cyan-100"
          href={`${import.meta.env.VITE_BLOCK_EXPLORER_TRANSACTION}${error.txHash}`}>transaction</a
        >.
      </li>
    {:else if error.action.type === 'EXIT'}
      <li>
        You can't exit on {spaceInfo.getPlanetInfo(error.location.x, error.location.y).stats.name} because an error ocurred
        on the
        <a
          target="_blank"
          class="underline text-cyan-100"
          href={`${import.meta.env.VITE_BLOCK_EXPLORER_TRANSACTION}${error.txHash}`}>transaction</a
        >.
      </li>
    {:else if error.action.type === 'RESOLUTION'}
      <li>
        You didn't resolve on {spaceInfo.getPlanetInfo(error.location.x, error.location.y).stats.name} because an error ocurred
        on the
        <a
          target="_blank"
          class="underline text-cyan-100"
          href={`${import.meta.env.VITE_BLOCK_EXPLORER_TRANSACTION}${error.txHash}`}>transaction</a
        >.
      </li>
    {:else}
      <li>
        An error ocurred for for this <a
          target="_blank"
          class="underline text-cyan-100"
          href={`${import.meta.env.VITE_BLOCK_EXPLORER_TRANSACTION}${error.txHash}`}>transaction</a
        >
      </li>
    {/if}
  </ul>
  <div class="text-center">
    <Button class="mt-4 text-center" label="Retry" on:click={acknowledge}>{okLabel}</Button>
  </div>
</Modal>
