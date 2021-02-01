<script lang="ts">
  import WalletAccess from '../templates/WalletAccess.svelte';
  import MapScreen from '../app/MapScreen.svelte';
  import {time, startTime} from '../stores/time';
  import {fade} from 'svelte/transition';
  import ClaimTokenScreen from '../screens/ClaimTokenScreen.svelte';
</script>

<WalletAccess>
  <ClaimTokenScreen />
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
