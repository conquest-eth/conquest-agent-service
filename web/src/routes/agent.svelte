<script lang="ts">
  import Button from '../components/PanelButton.svelte';
  import WalletAccess from '../templates/WalletAccess.svelte';
  import {wallet, builtin, flow, balance} from '../stores/wallet';
  import privateAccount from '../stores/privateAccount';
  import Help from '../components/Help.svelte';
  import {onDestroy, onMount} from 'svelte';
  import {agent} from '../stores/agent';
  import {nativeTokenSymbol} from '../config';
  import {timeToText} from '../lib/utils';
  import {now} from '../stores/time';

  onMount(() => {
    agent.start();
  });

  onDestroy(() => {
    agent.stop();
  });
</script>

<div class="w-screen h-screen bg-black">
  <WalletAccess>
    <div class="flex justify-center flex-wrap text-cyan-300">
      <h1 class="text-4xl m-4">
        conquest.eth agent
        <Help class="w-4 h-4">
          The agent page can be left open to ensure your fleet are resolved when
          they reach their destination. The only thing needed is that the agent
          is connected and has enough
          {nativeTokenSymbol}
          to perform the transactions
        </Help>
      </h1>

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
        {:else if $agent.state === 'Loading'}
          <p>Loading...</p>
        {:else}
          <p>Agent Address: {$agent.wallet?.address}</p>
          <p>
            Agent Balance:{$agent.balance
              .div('10000000000000000')
              .toNumber() / 100}
            (arround
            {$agent.balance.div($agent?.cost || 0)}
            fleet)

            <Button
              class="w-max-content m-4"
              label="Top Up"
              on:click={() => agent.topup()}>
              Top Up (for 10 fleets)
            </Button>
          </p>

          {#if $agent.lowETH}
            <p>
              The agent need to be topped up to perform the fleet resolution
            </p>
            <!-- <Button
              class="w-max-content m-4"
              label="Top Up"
              on:click={() => agent.topup()}>
              Top Up
            </Button> -->
          {:else if $agent.nextFleet}
            {#if $agent.nextFleet.time - now() > 0}
              Next Fleet to be resolved in
              {timeToText($agent.nextFleet.time - now())}
            {:else}Fleet being resolved...{/if}
          {:else}
            <p>No Fleet yet</p>
          {/if}
        {/if}
      </div>
    </div>
  </WalletAccess>
</div>
