<script lang="ts">
  import Map from './Map.svelte';
  import ConnectPanel from '$lib/components/account/ConnectPanel.svelte';
  import {account} from '$lib/account/account';
  import {TutorialSteps} from '$lib/account/constants';
  import Banner from '$lib/components/screen/Banner.svelte';
  import {bitMaskMatch, timeToText} from '$lib/utils';
  import PlayCoin from '$lib/components/utils/PlayCoin.svelte';
  import {spaceInfo} from '$lib/space/spaceInfo';
  import selection from '$lib/map/selection';
  import PlanetInfoPanel from '$lib/components/planets/PlanetInfoPanel.svelte';

  import claimFlow from '$lib/flows/claim';
  import ClaimFlow from '$lib/flows/ClaimFlow.svelte';
  import sendFlow from '$lib/flows/send';
  import SendFlow from '$lib/flows/SendFlow.svelte';
  import simulateFlow from '$lib/flows/simulateFlow';
  import SimulateFlow from '$lib/flows/SimulateFlow.svelte';
  import exitFlow from '$lib/flows/exit';
  import ExitFlow from '$lib/flows/ExitFlow.svelte';
  import resolveFlow from '$lib/flows/resolve';
  import ResolveFlow from '$lib/flows/ResolveFlow.svelte';
  import FleetsToResolve from '$lib/components/fleets/FleetsToResolve.svelte';
  import { spaceQueryWithPendingActions } from '$lib/space/optimisticSpace';


  // import messageFlow from '$lib/flows/message';
  // import MessageFlow from '$lib/flows/MessageFlow.svelte';
  // import showPlanetDepartures from '$lib/flows/showPlanetDepartures';
  // import ShowPlanetDeparturesFlow from '$lib/flows/ShowPlanetDeparturesFlow.svelte';
  // import Search from '$lib/components/utils/Search.svelte';

  // import {timeToText} from '$lib/utils';
  // import {spaceInfo} from '$lib/space/spaceInfo';
  // import {camera} from '$lib/map/camera';
</script>

<Map />

{#if $spaceQueryWithPendingActions.queryState.data?.loading}
<div class="w-full flex items-center justify-center fixed top-0 pointer-events-none" style="z-index: 5;">
  <p class="w-64 text-center rounded-bl-xl rounded-br-xl text-gray-200 bg-blue-500 p-1">
    Loading
  </p>
</div>
{/if}

<ConnectPanel />

<!-- <div class="opacity-40 bg-green-300 text-red-600 top-0 mx-auto z-50 absolute">
  CAMERA
  {#if $camera}
    {JSON.stringify(
      {
        x: Math.floor($camera.x * 100) / 100,
        y: Math.floor($camera.y * 100) / 100,
        zoom: $camera.zoom,
        renderX: Math.floor($camera.renderX * 100) / 100,
        renderY: Math.floor($camera.renderY * 100) / 100,
        renderWidth: Math.floor($camera.renderWidth * 100) / 100,
        renderHeight: Math.floor($camera.renderHeight * 100) / 100,
        width: Math.floor($camera.width * 100) / 100,
        height: Math.floor($camera.height * 100) / 100,
        renderScale: Math.floor($camera.renderScale * 100) / 100,
      },
      null,
      2
    )}
  {/if}
</div> -->

<div class="absolute right-0 top-12">
  <FleetsToResolve />
</div>

{#if $claimFlow.error || $claimFlow.step !== 'IDLE'}
  <ClaimFlow />
{/if}

{#if $sendFlow.error || $sendFlow.step !== 'IDLE'}
  <SendFlow />
{/if}

{#if $simulateFlow.error || $simulateFlow.step !== 'IDLE'}
  <SimulateFlow />
{/if}

{#if $resolveFlow.error || $resolveFlow.step !== 'IDLE'}
  <ResolveFlow />
{/if}

{#if $exitFlow.error || $exitFlow.step !== 'IDLE'}
  <ExitFlow />
{/if}

<!-- {#if $messageFlow.error || $messageFlow.step !== 'IDLE'}
  <MessageFlow />
{/if} -->

<!-- {#if $showPlanetDepartures.error || $showPlanetDepartures.step !== 'IDLE'}
  <ShowPlanetDeparturesFlow />
{/if} -->

<!--
{:else if $selection.id}
  <PlanetInfoPanel location={$selection.id} />
{:else}
  <Search />
{/if} -->

{#if $account.step === 'READY' && $account.remoteDisabledOrSynced && !bitMaskMatch($account.data?.welcomingStep, TutorialSteps.WELCOME)}
  <Banner on:mounted={() => selection.unselect()} on:close={() => account.recordWelcomingStep(TutorialSteps.WELCOME)}>
    <p>
      Welcome to
      <span class="text-cyan-600">conquest.eth</span>
      a game of war and diplomacy running on
      <a href="https://ethereum.org" target="_blank" class="text-cyan-100">ethereum</a>.
    </p>
    <p class="mt-3">
      To participate you'll have to first acquire planets by depositing a stake in form of
      <PlayCoin class="inline w-4" />
      (Play tokens).
    </p>
    <p class="mt-3">
      These planets will then produce spaceships that you can use to attack other planets. You'll also have to make sure
      you have enough spaceships to protect your planets. It is a good idea to reach out to other player and plan
      strategies together.
    </p>
    <p class="mt-3">
      At any time (whether you acquired the planet via staking or via attack), you can exit the planet. This take
      {timeToText(spaceInfo.exitDuration, {verbose: true})}
      during which you cannot use it but at the end of which you ll get the deposit, ready to be withdrawn.
    </p>
    <p class="mt-3">
      Be careful, even though your planet will continue to produce spaceships, you can lose it while waiting for the
      exit period to end.
    </p>
  </Banner>
{:else if $selection}
  <PlanetInfoPanel coords={$selection} />
{:else}
  <!-- <Search /> -->
{/if}
