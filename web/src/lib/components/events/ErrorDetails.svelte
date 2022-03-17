<script lang="ts">
  import {time} from '$lib/time';

  import {timeToText} from '$lib/utils';

  import Modal from '$lib/components/generic/Modal.svelte';
  import type {SpaceError} from '$lib/space/errors';
  import {account} from '$lib/account/account';
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

{#if error}
  <Modal
    maxWidth="max-w-screen-xl"
    globalCloseButton={closeButton}
    cancelable={closeButton}
    on:close
    border_color="border-red-400"
  >
    <div class="bg-black shadow sm:rounded-lg">
      <div class="px-4 py-5 sm:px-6">
        <h3 class="text-lg leading-6 font-medium text-green-400">
          {title}
        </h3>

        <p class="mt-1 max-w-2xl text-sm text-gray-500">
          {timeToText($time - error.action.timestamp, {compact: true})} ago
        </p>
      </div>
      <div class="border-t border-gray-800 px-4 py-5 sm:p-0">
        <dl class="sm:divide-y sm:divide-gray-800">
          <div class="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt class="text-sm font-medium text-gray-500">Sender / Owner</dt>
            <dd class="mt-1 text-sm text-gray-100 sm:mt-0 sm:col-span-2">...</dd>
          </div>

          <div class="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt class="text-sm font-medium text-gray-500">Destination Owner</dt>
            <dd class="mt-1 text-sm text-gray-100 sm:mt-0 sm:col-span-2">...</dd>
          </div>

          <div class="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt class="text-sm font-medium text-gray-500">Origin</dt>
            <dd class="mt-1 text-sm text-gray-100 sm:mt-0 sm:col-span-2">...</dd>
          </div>
          <div class="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt class="text-sm font-medium text-gray-500">Destination</dt>
            <dd class="mt-1 text-sm text-gray-100 sm:mt-0 sm:col-span-2">...</dd>
          </div>

          <div class="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt class="text-sm font-medium text-gray-500">Outcome</dt>
            <dd class="mt-1 text-sm text-gray-100 sm:mt-0 sm:col-span-2">
              <p class="text-green-400">...</p>
            </dd>
          </div>
          <div class="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt class="text-sm font-medium text-gray-500">Transaction</dt>
            <dd class="mt-1 text-sm text-gray-100 sm:mt-0 sm:col-span-2">
              <a
                href={`${import.meta.env.VITE_BLOCK_EXPLORER_TRANSACTION}${error.txHash}`}
                target="_blank"
                class="text-indigo-600 hover:text-indigo-100">{error.txHash}</a
              >
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <div class="text-center">
      <Button class="mt-4 text-center" label="Retry" on:click={acknowledge}>{okLabel}</Button>
    </div>
  </Modal>
{/if}
