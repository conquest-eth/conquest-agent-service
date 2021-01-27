<script lang="ts">
  import WalletAccess from '../templates/WalletAccess.svelte';
  import MapScreen from '../app/MapScreen.svelte';
  import time from '../stores/time';
  import {fade} from 'svelte/transition';
  import tokenClaim from '../stores/tokenClaim';
  import {wallet, flow} from '../stores/wallet';
  const startTime = $time;
</script>

<WalletAccess>
  {#if $tokenClaim.inUrl}
    <div class="fixed z-10 inset-0 overflow-y-auto bg-black">
      <div class="justify-center mt-10 text-center text-white">
        <p>Welcome to conquest.eth</p>
        <p>You have been given some tokens to claim.</p>
        {#if $wallet.state === 'Ready'}
          {#if $tokenClaim.state === 'Loading'}
            Loading claim...
          {:else if $tokenClaim.state === 'Available'}
            <button on:click={() => tokenClaim.claim()}>Claim</button>
          {:else if $tokenClaim.state === 'Claiming'}
            Claiming...
          {:else if $tokenClaim.state === 'Claimed'}
            <button on:click={() => tokenClaim.clearURL()}>Continue</button>
          {/if}
        {:else}
          <p>Please connect to your wallet</p>
          <button on:click={() => flow.connect()}>Connect</button>
        {/if}
      </div>
    </div>
  {/if}
  <MapScreen />
</WalletAccess>

{#if $time - startTime < 5}
  <div class="fixed z-10 inset-0 overflow-y-auto bg-black" out:fade>
    <div class="justify-center mt-10 text-center">
      <img
        class="mb-8 mx-auto"
        src="./conquest.png"
        alt="conquest.eth"
        style="width:80%;" />
      <p class="m-6 text-gray-500 dark:text-gray-400 text-xl">
        An unstoppable game of war and diplomacy running on ethereum
      </p>
    </div>
  </div>
{/if}

{#if $time - startTime < 2}
  <div class="fixed z-10 inset-0 overflow-y-auto bg-black" out:fade>
    <div class="justify-center mt-10 text-center">
      <img
        class="mb-8 mx-auto"
        src="./etherplay_logo_text_under.png"
        alt="etherplay.eth"
        style="width:40%; heigh: 40%;" />
      <p class="m-6 text-gray-500 dark:text-gray-400 text-xl">presents</p>
    </div>
  </div>
{/if}
