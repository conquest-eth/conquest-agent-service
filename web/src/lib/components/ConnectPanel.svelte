<script lang="ts">
  import PanelButton from './PanelButton.svelte';
  import NavButton from './navigation/NavButton.svelte';
  import {wallet} from '$lib/stores/wallet';
  import {playTokenAccount} from '$lib/stores/playToken';
  import privateAccount from '$lib/stores/privateAccount';
  import Blockie from './Blockie.svelte';
  import Help from './Help.svelte';
  import PlayCoin from './PlayCoin.svelte';
  import {base} from '$app/paths';

  function connect() {
    privateAccount.login();
  }
  function disconnect() {
    wallet.disconnect();
  }
  let menu = false;
</script>

<svelte:window on:click={() => (menu = false)} />

{#if $wallet.address}
  {#if !($privateAccount.step === 'READY')}
    <div class="absolute right-0 top-16 bg-gray-900 bg-opacity-80 z-10">
      <PanelButton class="m-1" label="Connect" on:click={connect}>
        Sign In
        <Help class="w-4 h-4">
          By signing in, you ll be able to send spaceships and see your travelling fleets (if any).
        </Help>
      </PanelButton>
    </div>
  {/if}

  <div on:click={(e) => e.stopPropagation()} class="absolute right-0 bg-gray-900 bg-opacity-80 z-10">
    <div class="flex items-center">
      <span class="text-yellow-300 font-black pr-4">
        {#if $playTokenAccount.balance}
          {'' + $playTokenAccount.balance.div('10000000000000000').toNumber() / 100 + ''}
          <PlayCoin class="inline w-4" />
        {:else}
          ...
          <PlayCoin class="inline w-4" />
        {/if}
      </span>
      <span class="inline-block align-middle" on:click={() => (menu = !menu)}>
        <Blockie class="w-10 h-10 m-1" address={$wallet.address} />
      </span>
    </div>
  </div>
  <div class="bg-cyan-500 absolute right-0 top-12 w-20 h-1 m-0" />
  <div class="bg-cyan-700 absolute right-9 top-12 w-14 h-1 m-0" />
  <div class="bg-cyan-900 absolute right-20 top-12 w-10 h-1 m-0" />
  {#if menu}
    <!-- <div
        class="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
        <div
          class="py-1"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="options-menu"> -->

    <!-- <a
            href="#"
            class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            role="menuitem">Account settings</a>
          <a
            href="#"
            class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            role="menuitem">Support</a>
          <a
            href="#"
            class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            role="menuitem">License</a>
          <form method="POST" action="#">
            <button
              type="submit"
              class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:bg-gray-100 focus:text-gray-900"
              role="menuitem">
              Sign out
            </button>
          </form> -->
    <!-- </div>
      </div> -->
    <div
      class="absolute z-10 right-0 top-14 border-cyan-500 border-2 p-5 bg-opacity-80 bg-black flex mr-2 flex-col items-center">
      <NavButton class="m-1" label="withdrawals" href={`${base}/withdrawals/`}>
        Withdrawals
        <Help class="w-4 h-4">
          Here you'll be able to withdraw the
          <PlayCoin class="w-4 h-4 inline" />
          you earned after exiting your planets.
        </Help>
      </NavButton>
      <NavButton class="m-1" label="agent" href={`${base}/agent/`} blank={true}>
        Agent
        <Help class="w-4 h-4">The agent can help you ensure you resolve your fleets in time.</Help>
      </NavButton>
      <NavButton class="m-1" label="agent" href="{`${base}/settings/`}}">
        Profile
        <Help class="w-4 h-4">You can setup your profile so that other player can contact you.</Help>
      </NavButton>
      <PanelButton class="m-1" label="Disconnect" on:click={disconnect}>Disconnect</PanelButton>
    </div>
  {/if}
{:else}
  <div class="absolute right-0 bg-gray-900 bg-opacity-80 z-10">
    <PanelButton class="m-1" label="Connect" on:click={connect}>
      Connect
      <!--  TODO ?<Help inverted={true} class="w-4 h-4">
      Hello d
      <span class="text-red-500">s dsads ad</span>sdas dWorld!
    </Help> -->
    </PanelButton>
  </div>
{/if}
