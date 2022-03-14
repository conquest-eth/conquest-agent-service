<script lang="ts">
  import claimFlow from '$lib/flows/claim';
  import Modal from '$lib/components/generic/Modal.svelte';
  import Button from '$lib/components/generic/PanelButton.svelte';
  import {planets} from '$lib/space/planets';
  import {wallet} from '$lib/blockchain/wallet';
  // TODO use myTokens ?
  import {tokenAccount} from '$lib/account/token';
  import {BigNumber} from '@ethersproject/bignumber';
  import PlayCoin from '$lib/components/utils/PlayCoin.svelte';
  import {formatError, timeToText} from '$lib/utils';
  import {spaceInfo} from '$lib/space/spaceInfo';
  import NavButton from '$lib/components/navigation/NavButton.svelte';
  import {base} from '$app/paths';

  $: coords = $claimFlow.data?.coords;
  $: planetInfo = coords ? spaceInfo.getPlanetInfo(coords.x, coords.y) : undefined;
  $: planetState = planetInfo ? planets.planetStateFor(planetInfo) : undefined;
  $: stats = planetInfo ? planetInfo.stats : undefined;
  $: stake = stats && stats.stake;
  $: cost = stats ? BigNumber.from(stats.stake) : undefined; // TODO multiplier from config/contract

  $: result =
    planetInfo && $planetState ? spaceInfo.simulateCapture($wallet.address, planetInfo, $planetState) : undefined;
</script>

{#if $claimFlow.error}
  <Modal on:close={() => claimFlow.acknownledgeError()}>
    <div class="text-center">
      <h2>An error happenned For Planet Staking</h2>
      <p class="text-red-500 mt-2 text-sm">{formatError($claimFlow.error)}</p>
      <Button class="mt-5" label="Stake" on:click={() => claimFlow.acknownledgeError()}>Ok</Button>
    </div>
  </Modal>
{:else if $claimFlow.cancelingConfirmation}
  <Modal
    closeButton={true}
    globalCloseButton={true}
    on:close={() => claimFlow.cancelCancelation()}
    on:confirm={() => claimFlow.cancel()}
  >
    <div class="text-center">
      <p class="pb-4">Are you sure to cancel ?</p>
      <p class="pb-4">(This will prevent the game to record your transaction, if you were to execute it afterward)</p>
      <Button label="OK" on:click={() => claimFlow.cancel()}>Yes</Button>
    </div>
  </Modal>
{:else if $claimFlow.step === 'CONNECTING'}
  <!---->
{:else if $claimFlow.step === 'CHOOSE_STAKE' && $wallet.state == 'Ready'}
  <Modal on:close={() => claimFlow.cancel()}>
    {#if $tokenAccount.status === 'Idle'}
      Please wait...
    {:else if $tokenAccount.status === 'WaitingContracts'}
      Please wait...
    {:else if $tokenAccount.status === 'Ready'}
      {#if !$tokenAccount.balance}
        Fetching Balance...
      {:else if $tokenAccount.balance.eq(0)}
        You do not have any
        <PlayCoin class="inline w-4" />. You need
        {cost.toString()}
        <PlayCoin class="inline w-4" />. If you have never got any token, please visit our
        <a href="https://discord.gg/Qb4gr2ekfr" class="underline" target="_blank" rel="noopener">discord</a> and talk to
        our bot "Etherplay Discord Bot"
      {:else if $tokenAccount.balance.lt(cost.mul('1000000000000000000'))}
        Not enough
        <PlayCoin class="inline w-4" />. You need
        <span class="text-yellow-400">{cost.toString()}</span>
        <PlayCoin class="inline w-4" />
        but you have only
        <span class="text-yellow-400">{$tokenAccount.balance.div('1000000000000000000').toString()}</span>
      {:else}
        <div class="text-center">
          <h2>
            Stake
            <span class="text-yellow-500"
              >{stake}
              <PlayCoin class="inline w-4" /></span
            >
            to activate Planet
            <span class="text-green-500">"{stats.name}"</span>.
          </h2>
          <p class="text-gray-300 mt-2 text-sm">
            You'll be able to get your stake back if you manage to exit the planet safely (this takes
            {timeToText(spaceInfo.exitDuration, {verbose: true})}).
          </p>
          <p class="text-blue-400 mt-2 text-sm">
            Once the tx will be mined, the planet will start with
            {result && result.numSpaceshipsLeft}
            spaceships and will produce
            {stats.production / 60}
            spaceships per minutes.
          </p>
          <Button class="mt-5" label="Stake" on:click={() => claimFlow.confirm()}>Confirm</Button>
        </div>
      {/if}
    {/if}
  </Modal>
{:else if $claimFlow.step === 'CREATING_TX'}
  <!-- {@debug $claimFlow} -->
  <Modal>Preparing the Transaction...</Modal>
{:else if $claimFlow.step === 'WAITING_TX'}
  <Modal
    closeButton={true}
    globalCloseButton={true}
    closeOnOutsideClick={false}
    on:close={() => claimFlow.cancel(true)}
  >
    Please Accept the Transaction...
  </Modal>
{:else if $claimFlow.step === 'PROFILE_INFO'}
  <Modal on:close={() => claimFlow.acknowledgeProfileSuggestion()}>
    <p class="text-center">
      Great! if all goes well (nobody attempted to capture that planet at the same time), you ll be owning your first
      planet in
      <span class="text-cyan-700">conquest.eth</span>
      very soon!
    </p>
    <p class="text-center">
      You did not setup any profile info yet. We suggest you add info to your profile so other player can communicate
      with you and make plan together to conquer the universe!
    </p>
    <p class="text-center mt-3">
      <NavButton label="profile" href={`${base}/settings`}>Setup Profile</NavButton>
    </p>
  </Modal>
{/if}
