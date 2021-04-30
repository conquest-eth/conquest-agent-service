<script lang="ts">
  import Button from '$lib/components/PanelButton.svelte';
  import NavButton from '$lib/components/navigation/NavButton.svelte';
  import WalletAccess from '$lib/WalletAccess.svelte';
  import {wallet, builtin, flow, balance} from '$lib/stores/wallet';
  import privateAccount from '$lib/stores/privateAccount';
  import Help from '$lib/components/Help.svelte';
  import {onDestroy, onMount} from 'svelte';
  import {agent} from '$lib/stores/agent';
  import {nativeTokenSymbol} from '$lib/config';
  import {timeToText} from '$lib/utils';
  import {now} from '$lib/stores/time';
  import {base} from '$app/paths';

  onMount(() => {
    agent.start();
  });

  onDestroy(() => {
    agent.stop();
  });
</script>

<div class="w-full h-full bg-black">
  <NavButton class="absolute" label="Back To Game" href={`${base}/`} blank={true}>Go To Game</NavButton>
  <WalletAccess>
    <div class="flex justify-center flex-wrap text-cyan-300">
      <h1 class="text-4xl m-4 mt-10">
        conquest.eth agent
        <Help class="w-4 h-4">
          The agent page can be left open to ensure your fleet are resolved when they reach their destination. The only
          thing needed is that the agent is connected and has enough
          {nativeTokenSymbol}
          to perform the transactions
        </Help>
      </h1>
    </div>
    {#if $privateAccount.step === 'READY'}
      <div class="flex flex-col text-center justify-center text-red-500 mb-8">
        <p>Keep this tab open to ensure your fleet get resolved in time.</p>
        <p>Please also ensure you remain on the same account and network. Changing them will stop the agent.</p>
        <p>
          Also note that some wallet like Metamask timeout after some time and you might need to reconnect. You might
          also want to keep the tab in focus.
        </p>
      </div>
    {/if}
    <div class="flex justify-center flex-wrap text-cyan-300">
      <div class="w-full justify-center text-center">
        {#if $privateAccount.step !== 'READY'}
          {#if $privateAccount.step === 'CONNECTING' || $privateAccount.step === 'LOADING'}
            <p>Loading...</p>
          {:else}
            <Button
              class="w-max-content m-4"
              label="connect"
              disabled={!$builtin.available || $wallet.connecting}
              on:click={() => privateAccount.login()}>
              Connect
            </Button>
          {/if}
        {:else if $agent.state === 'Loading' || !$agent.balance}
          <p>Loading...</p>
        {:else}
          <p>Agent Address: {$agent.wallet?.address}</p>
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
            <!-- <Button
              class="w-max-content m-4"
              label="Top Up"
              on:click={() => agent.topup()}>
              Top Up
            </Button> -->
          {:else if $agent.nextFleets && $agent.nextFleets.length > 0}
            {#if $agent.nextFleets[0].time - now() > 0}
              Next Fleet to be resolved in
              {timeToText($agent.nextFleets[0].time - now())}
            {:else}Fleet being resolved...{/if}
          {:else}
            <p>No Fleet yet</p>
          {/if}
        {/if}
      </div>
    </div>
  </WalletAccess>
</div>
