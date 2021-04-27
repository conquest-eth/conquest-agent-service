<script lang="ts">
  import Map from './Map.svelte';
  import ConnectPanel from '$lib/components/ConnectPanel.svelte';

  import claimFlow from '$lib/stores/claim';
  import ClaimFlow from '$lib/flows/ClaimFlow.svelte';
  import sendFlow from '$lib/stores/send';
  import SendFlow from '$lib/flows/SendFlow.svelte';
  import exitFlow from '$lib/stores/exit';
  import ExitFlow from '$lib/flows/ExitFlow.svelte';
  import resolveFlow from '$lib/stores/resolve';
  import ResolveFlow from '$lib/flows/ResolveFlow.svelte';
  import FleetsToResolve from '$lib/components/FleetsToResolve.svelte';
  import messageFlow from '$lib/stores/message';
  import MessageFlow from '$lib/flows/MessageFlow.svelte';
  import showPlanetDepartures from '$lib/stores/showPlanetDepartures';
  import ShowPlanetDeparturesFlow from '$lib/flows/ShowPlanetDeparturesFlow.svelte';
  import Search from '$lib/components/Search.svelte';
  import PlanetInfoPanel from '$lib/components/PlanetInfoPanel.svelte';
  import privateAccount from '$lib/stores/privateAccount';
  import Banner from '$lib/components/Banner.svelte';
  import PlayCoin from '$lib/components/PlayCoin.svelte';
  import {timeToText} from '$lib/utils';
  import {spaceInfo} from '$lib/app/mapState';
  import {TutorialSteps} from '$lib/stores/constants';
  import selection from '$lib/stores/selection';
</script>

<Map />

<ConnectPanel />

<div class="absolute right-0 top-12">
  <FleetsToResolve />
</div>

{#if $claimFlow.error || $claimFlow.step !== 'IDLE'}
  <ClaimFlow />
{/if}

{#if $sendFlow.error || $sendFlow.step !== 'IDLE'}
  <SendFlow />
{/if}

{#if $resolveFlow.error || $resolveFlow.step !== 'IDLE'}
  <ResolveFlow />
{/if}

{#if $exitFlow.error || $exitFlow.step !== 'IDLE'}
  <ExitFlow />
{/if}

{#if $messageFlow.error || $messageFlow.step !== 'IDLE'}
  <MessageFlow />
{/if}

{#if $showPlanetDepartures.error || $showPlanetDepartures.step !== 'IDLE'}
  <ShowPlanetDeparturesFlow />
{/if}

{#if $privateAccount.step === 'READY' && !privateAccount.ckeckCompletion($privateAccount.data?.welcomingStep, TutorialSteps.WELCOME)}
  <Banner
    on:mounted={() => selection.unselect()}
    on:close={() => privateAccount.recordWelcomingStep(TutorialSteps.WELCOME)}>
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
      you have enough spaceships to protect your planets.
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
{:else if $selection.id}
  <PlanetInfoPanel location={$selection.id} />
{:else}
  <Search />
{/if}
