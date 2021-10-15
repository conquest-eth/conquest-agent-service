<script lang="ts">
  import Modal from '$lib/components/generic/Modal.svelte';
  import type {SpaceError} from '$lib/space/errors';
  import {account} from '$lib/account/account';
  import {spaceInfo} from '$lib/space/spaceInfo';
  import Button from '$lib/components/generic/PanelButton.svelte';

  export let error: SpaceError;
  export let isShow;
  let title;

  $: if (error?.status === 'FAILURE') {
    title = 'Your transaction failed';
  } else if (error?.status === 'CANCELED') {
    title = 'Your transaction was canceled';
  } else {
    title = 'Your transaction has timed out';
  }

  async function acknowledge() {
    await account.acknowledgeError(error.txHash, null);
    error = null;
    isShow = isShow && false;
  }
</script>

{#if isShow}
  <Modal
    {title}
    globalCloseButton={true}
    on:close={() => {
      isShow = false;
      error = null;
    }}
  >
    <ul class="mt-10 text-white">
      {#if error.action.type === 'CAPTURE'}
        <li>
          You didn't capture planet {spaceInfo.getPlanetInfo(error.location.x, error.location.y).stats.name} because an error
          ocurred on the transaction.
        </li>
      {/if}
      {#if error.action.type === 'EXIT'}
        <li>
          You can't exit on {spaceInfo.getPlanetInfo(error.location.x, error.location.y).stats.name} because an error ocurred
          on the transaction.
        </li>
      {/if}
      {#if error.action.type === 'RESOLUTION'}
        <li>
          You didn't resolve on {spaceInfo.getPlanetInfo(error.location.x, error.location.y).stats.name} because an error
          ocurred on the transaction.
        </li>
      {/if}
      {#if error.action.type === 'WITHDRAWAL'}
        <li>
          You didn't withdrawn on planet {spaceInfo.getPlanetInfo(error.location.x, error.location.y).stats.name} because
          an error ocurred on the transaction.
        </li>
      {/if}
    </ul>
    <div class="text-center">
      <Button class="mt-4 text-center" label="Retry" on:click={acknowledge}>Ok</Button>
    </div>
  </Modal>
{/if}
