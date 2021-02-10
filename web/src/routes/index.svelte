<script lang="ts">
  import WalletAccess from '../templates/WalletAccess.svelte';
  import MapScreen from '../app/MapScreen.svelte';
  import {time, startTime, now} from '../stores/time';
  import {fade} from 'svelte/transition';
  import ClaimTokenScreen from '../screens/ClaimTokenScreen.svelte';
  import privateAccount from '../stores/privateAccount';
  import Banner from '../components/Banner.svelte';
  import PlayCoin from '../components/PlayCoin.svelte';

  let result;
  try {
    result = localStorage.getItem('_conquest_visited');
  } catch (e) {}
  const visited = result === 'true';

  let stageTime = startTime;
  let stage = visited ? 1 : 0;
  let timeout: number | undefined;

  function loaded(timeIn: number) {
    return () => {
      const diff = now() - stageTime;
      if (diff > timeIn) {
        nextStage();
      } else {
        timeout = (setTimeout(
          nextStage,
          (timeIn - diff) * 1000
        ) as unknown) as number;
      }
    };
  }

  const gameLogoReady = visited ? loaded(2) : loaded(5);
  const etherplayLogoReady = loaded(2);

  function nextStage() {
    if (timeout) {
      clearTimeout(timeout);
    }
    stageTime = now();
    stage++;
    if (stage === 2) {
      try {
        localStorage.setItem('_conquest_visited', 'true');
      } catch (e) {}
    }
  }
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
        stake in form of
        <PlayCoin class="inline w-4" />
        (Play tokens)
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

{#if stage === 1}
  <div
    class="fixed z-50 inset-0 overflow-y-auto bg-black"
    out:fade
    on:click={() => nextStage()}>
    <div class="justify-center mt-32 text-center">
      <img
        class="mb-8 mx-auto max-w-md h-36"
        src="./conquest.png"
        alt="conquest.eth"
        style="width:80%;"
        on:load={() => gameLogoReady()} />
      <p class="m-6 mt-20 text-gray-500 text-2xl font-black">
        An unstoppable and open-ended game of war and diplomacy running on
        ethereum.
      </p>
    </div>
  </div>
{/if}

{#if stage === 0}
  <div
    class="fixed z-50 inset-0 overflow-y-auto bg-black h-full"
    out:fade
    on:click={() => nextStage()}>
    <div class="justify-center text-center h-full flex items-center">
      <img
        class="mb-8 mx-auto max-w-xs"
        src="./logo_with_text_on_black.png"
        alt="etherplay.eth"
        style="width:80%; heigh: 40%;"
        on:load={() => etherplayLogoReady()} />
      <!-- <p class="m-6 text-gray-400 dark:text-gray-500 text-4xl font-black">
      presents
    </p> -->
    </div>
  </div>
{/if}
