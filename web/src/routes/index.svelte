<script lang="ts">
  import Storereader from '$lib/components/storereader.svelte';

  import WalletAccess from '$lib/blockchain/WalletAccess.svelte';
  import MapScreen from '$lib/screens/map/MapScreen.svelte';
  import {fade} from 'svelte/transition';
  import ClaimTokenScreen from '$lib/screens/tokenClaim/ClaimTokenScreen.svelte';

  import {logo} from '$lib/screens/loading/logo';

  import {onMount} from 'svelte';
  import {browser} from '$app/env';

  onMount(() => {
    logo.start();
  });
</script>

<Storereader />

<WalletAccess>
  <ClaimTokenScreen />
  <MapScreen />
</WalletAccess>

{#if $logo && $logo.stage === 1}
  <div class="fixed z-50 inset-0 overflow-y-auto bg-black" out:fade on:click={() => logo.nextStage()}>
    <div class="justify-center mt-32 text-center">
      <img
        class="mb-8 mx-auto max-w-md"
        src="./conquest.png"
        alt="conquest.eth"
        style="width:80%;"
        on:load={() => logo.gameLogoReady()}
      />
      <p class="m-6 mt-20 text-gray-500 text-2xl font-black">
        An unstoppable and open-ended game of war and diplomacy running on ethereum.
      </p>
    </div>
  </div>
{/if}

{#if $logo && $logo.stage === 0}
  <div class="fixed z-50 inset-0 overflow-y-auto bg-black h-full" out:fade on:click={() => logo.nextStage()}>
    <div class="justify-center text-center h-full flex items-center">
      {#if browser}
        <img
          class="mb-8 mx-auto max-w-xs"
          src="./logo_with_text_on_black.png"
          alt="etherplay.eth"
          style="width:80%; heigh: 40%;"
          on:load={() => logo.etherplayLogoReady()}
        />
        <!-- <p class="m-6 text-gray-400 dark:text-gray-500 text-4xl font-black">
      presents
    </p> -->
      {/if}
    </div>
  </div>
{/if}
