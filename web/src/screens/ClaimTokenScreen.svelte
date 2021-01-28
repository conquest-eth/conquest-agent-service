<script lang="ts">
  import tokenClaim from '../stores/tokenClaim';
  import {wallet, flow} from '../stores/wallet';
  import Button from '../components/PanelButton.svelte';
</script>

{#if $tokenClaim.inUrl}
  <div class="fixed z-10 inset-0 overflow-y-auto bg-black">
    <div class="relative bg-gray-900 border-2 border-cyan-300 top-1 mx-1">
      <div class="max-w-screen-xl mx-auto py-3 px-3 sm:px-6 lg:px-8">
        <div class="sm:text-center sm:px-16 text-cyan-300 text-center">
          Welcome to conquest.eth
        </div>
        <div
          class="absolute inset-y-0 right-0 pt-1 pr-1 flex items-start sm:pt-1 sm:pr-2 sm:items-start" />
      </div>
    </div>
    <div class="justify-center mt-10 text-center text-white">
      <p>You have been given some tokens to claim.</p>
      {#if $wallet.state === 'Ready'}
        {#if $tokenClaim.state === 'Loading'}
          Loading claim...
        {:else if $tokenClaim.state === 'Available'}
          <Button
            class="mt-4"
            label="claim"
            on:click={() => tokenClaim.claim()}>
            Claim
          </Button>
        {:else if $tokenClaim.state === 'Claiming'}
          Claiming...
        {:else if $tokenClaim.state === 'Claimed'}
          <Button
            class="mt-4"
            label="continue"
            on:click={() => tokenClaim.clearURL()}>
            Continue
          </Button>
        {/if}
      {:else}
        <p>Please connect to your wallet</p>
        <Button class="mt-4" label="connect" on:click={() => flow.connect()}>
          Connect
        </Button>
      {/if}
    </div>
  </div>
{/if}
