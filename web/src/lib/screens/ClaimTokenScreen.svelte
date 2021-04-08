<script lang="ts">
  import tokenClaim from '$lib/stores/tokenClaim';
  import {wallet, flow} from '$lib/stores/wallet';
  import Button from '$lib/components/PanelButton.svelte';
</script>

{#if $tokenClaim.inUrl}
  <div class="fixed z-40 inset-0 overflow-y-auto bg-black">
    <div class="relative bg-gray-900 border-2 border-cyan-300 top-1 mx-1">
      <div class="max-w-screen-xl mx-auto py-3 px-3 sm:px-6 lg:px-8">
        <div class="sm:text-center sm:px-16 text-cyan-300 text-center">Welcome to conquest.eth</div>
        <div class="absolute inset-y-0 right-0 pt-1 pr-1 flex items-start sm:pt-1 sm:pr-2 sm:items-start" />
      </div>
    </div>
    <div class="justify-center mt-10 text-center text-white">
      {#if $wallet.state === 'Ready'}
        {#if $tokenClaim.state === 'Loading'}
          <p class="text-green-500">Congratulation! You have been given some tokens to claim.</p>
          <p class="mt-5">Loading claim...</p>
        {:else if $tokenClaim.state === 'Available'}
          <p class="text-green-500">Congratulation! You have been given some tokens to claim.</p>
          <Button class="mt-4" label="claim" on:click={() => tokenClaim.claim()}>Claim</Button>
        {:else if $tokenClaim.state === 'Claiming'}
          <p class="mt-5">Please wait while the claim is being executed...</p>
        {:else if $tokenClaim.state === 'Claimed'}
          <p class="m-5 text-green-500">The tokens are now yours!</p>
          <Button class="mt-4" label="continue" on:click={() => tokenClaim.clearURL()}>Continue</Button>
        {:else if $tokenClaim.state === 'AlreadyClaimed'}
          <p class="m-5 text-red-500">The tokens have already been claimed. No more tokens to be given.</p>
          <Button class="mt-4" label="continue" on:click={() => tokenClaim.clearURL()}>Continue</Button>
        {/if}
      {:else}
        <p class="text-green-500">Congratulation! You have been given some tokens to claim.</p>
        <p class="m-5">Please connect to your wallet</p>
        <Button class="mt-4" label="connect" on:click={() => flow.connect()}>Connect</Button>
      {/if}
    </div>
  </div>
{/if}
