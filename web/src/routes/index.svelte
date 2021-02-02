<script lang="ts">
  import WalletAccess from '../templates/WalletAccess.svelte';
  import MapScreen from '../app/MapScreen.svelte';
  import {time, startTime} from '../stores/time';
  import {fade} from 'svelte/transition';
  import ClaimTokenScreen from '../screens/ClaimTokenScreen.svelte';
  import privateAccount from '../stores/privateAccount';
  import Banner from '../components/Banner.svelte';
</script>

<WalletAccess>
  <ClaimTokenScreen />
  <MapScreen />
  {#if $privateAccount.step === 'READY' && $privateAccount.data && !$privateAccount.data.welcomed}
    <Banner on:close={() => privateAccount.recordWelcomed()}>
      <p>
        Welcome to
        <span class="text-cyan-600">conquest.eth</span>
        a game of war and diplomacy running on
        <a
          href="https://ethereum.org"
          target="_blank"
          class="text-cyan-100">ethereum</a>.
      </p>
      <p class="mt-3">
        To participate you'll have to first acquire planets by depositing a
        stake in form of Play tokens
      </p>
      <p class="mt-3">
        These planets will then produce spaceships that you can use to attack
        other planets. You'll also have to make sure you have enough spaceships
        to protect your planets.
      </p>
      <p class="mt-3">
        At any time (whether you acquired the planet via staking or via attack),
        you can exit the planet. This take 24h during which you cannot use it
        but at the end of which you ll get the deposit, ready to be withdrawn.
      </p>
      <p class="mt-3">
        Be careful though, you can lose your planet while waiting for the exit
        period to end.
      </p>
    </Banner>
  {/if}
</WalletAccess>

{#if $time - startTime < 5}
  <div class="fixed z-10 inset-0 overflow-y-auto bg-black" out:fade>
    <div class="justify-center mt-10 text-center">
      <img
        class="mb-8 mx-auto max-w-md"
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
        class="mb-8 mx-auto max-w-xs"
        src="./etherplay_logo_text_under.png"
        alt="etherplay.eth"
        style="width:40%; heigh: 40%;" />
      <p class="m-6 text-gray-500 dark:text-gray-400 text-xl">presents</p>
    </div>
  </div>
{/if}
