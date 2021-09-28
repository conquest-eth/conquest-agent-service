<script lang="ts">
  import Button from '$lib/components/generic/PanelButton.svelte';
  import NavButton from '$lib/components/navigation/NavButton.svelte';
  import WalletAccess from '$lib/blockchain/WalletAccess.svelte';
  import {wallet, builtin, flow, balance} from '$lib/blockchain/wallet';
  import Help from '$lib/components/utils/Help.svelte';
  import PendingFleetElement from '$lib/components/fleets/PendingFleetElement.svelte';
  import {base} from '$app/paths';
  import {privateWallet} from '$lib/account/privateWallet';
  import {pendingActions} from '$lib/account/pendingActions';

  $: loading = $pendingActions.reduce((prev: boolean, curr) => prev || curr.status === 'LOADING', false);
</script>

<div class="w-full h-full bg-black">
  <NavButton class="absolute" label="Back To Game" href={`${base}/`}>
    <!-- blank={true} -->
    Go To Game
  </NavButton>
  <WalletAccess>
    <div class="flex justify-center flex-wrap text-cyan-300">
      <h1 class="text-4xl m-4 mt-10">
        conquest.eth agent service
        <Help class="w-4 h-4">
          The agent service is provided by Etherplay to help your fleets being resolved in time. In order to work, the
          agent wallet (See below) neet to be topped up.
        </Help>
      </h1>
    </div>
    {#if $privateWallet.step === 'READY'}
      <div class="flex flex-col text-center justify-center text-red-500 mb-8">
        <p>
          The agent service is provided by Etherplay to help your fleets being resolved in time. In order to work, the
          agent wallet (See below) neet to be topped up.
        </p>
        <p>
          Note that we cannot guarantee that fleets will be resolved and this service is purely optional. You can always
          resolve your fleet manually. We will do our best to broadcast the transaction in time.
        </p>
        <p>
          We will also do our best to keep your fleet destination private and we will never read the data, except for
          debugging purpose but with no intent to use that information in game.
        </p>
      </div>
    {/if}
    <div class="flex justify-center flex-wrap text-cyan-300">
      <div class="w-full justify-center text-center">
        {#if $privateWallet.step !== 'READY'}
          {#if $privateWallet.step === 'CONNECTING'}
            <p>Connecting...</p>
          {:else}
            <Button
              class="w-max-content m-4"
              label="connect"
              disabled={!$builtin.available || $wallet.connecting}
              on:click={() => privateWallet.login()}
            >
              Connect
            </Button>
          {/if}
          <!-- {:else if $agent.state === 'Loading' || !$agent.balance}
          <p>Loading...</p> -->
        {:else}
          <!-- <p>Agent Address: {$agent.wallet?.address}</p>
          <p>
            Agent Balance:
            {$agent.balance.div('100000000000000').toNumber() / 10000}
            ${nativeTokenSymbol}
            (arround
            {$agent.balance.div($agent?.cost || 0)}
            fleet)

            <Button class="w-max-content m-4" label="Top Up" on:click={() => agent.topup()}>
              Top Up (for 10 fleets)
            </Button>
          </p>

          {#if $agent.lowETH}
            <p class="text-red-500">The agent need to be topped up to perform the fleet resolution</p>
            <Button
              class="w-max-content m-4"
              label="Top Up"
              on:click={() => agent.topup()}>
              Top Up
            </Button>
          {:else if $pendingActions && $pendingActions.length > 0} -->
          {#if loading}
            Loading...
          {:else if $pendingActions && $pendingActions.length > 0}
            Here is a list of the fleets
            <ul class="list-disc text-yellow-600">
              {#each $pendingActions as pendingAction}
                {#if pendingAction.action.type === 'SEND' && pendingAction.status !== 'FAILURE' && pendingAction.status !== 'LOADING' && pendingAction.status !== 'CANCELED' && pendingAction.status !== 'TIMEOUT'}
                  <li><PendingFleetElement {pendingAction} /></li>
                {/if}
              {/each}
            </ul>
          {:else}
            <p>No Fleet yet</p>
          {/if}
        {/if}
      </div>
    </div>
  </WalletAccess>
</div>

<!-- <script lang="ts">
  import {base} from '$app/paths';
  import type {CheckedPendingAction} from '$lib/account/pendingActions';
  import {pendingActions} from '$lib/account/pendingActions';
  import {privateWallet} from '$lib/account/privateWallet';
  import WalletAccess from '$lib/blockchain/WalletAccess.svelte';
  import PendingFleetElement from '$lib/components/fleets/PendingFleetElement.svelte';
  import NavButton from '$lib/components/navigation/NavButton.svelte';
  import FleetElement from '$lib/screens/map/FleetElement.svelte';
  import {fleets} from '$lib/space/fleets';
  import {onMount} from 'svelte';

  onMount(() => {
    // privateWallet.login();
  });
</script>

<WalletAccess>
  <div class="w-full h-full bg-black text-white">
    <NavButton label="Back To Game" href={`${base}/`}>Back To Game</NavButton>

    {$fleets.length}

    {#if $fleets}
      {#each $fleets as fleet}
        {#if fleet.state !== 'WAITING_ACKNOWLEDGMENT'}
          {fleet.txHash}
        {/if}
      {/each}
    {/if}

    <div>
      {#each $pendingActions as pendingAction}
        {#if pendingAction.action.type === 'SEND' && pendingAction.status !== 'FAILURE' && pendingAction.status !== 'LOADING' && pendingAction.status !== 'CANCELED' && pendingAction.status !== 'TIMEOUT'}
          <PendingFleetElement {pendingAction} />
        {/if}
      {/each}
    </div>
  </div>
</WalletAccess> -->
