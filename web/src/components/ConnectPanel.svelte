<script lang="ts">
  import PanelButton from './PanelButton.svelte';
  import NavButton from './navigation/NavButton.svelte';
  import {wallet} from '../stores/wallet';
  import {playTokenAccount} from '../stores/playToken';
  import privateAccount from '../stores/privateAccount';
  import Blockie from './Blockie.svelte';
  import Help from './Help.svelte';

  function connect() {
    privateAccount.login();
  }
  function disconnect() {
    wallet.disconnect();
  }
  let menu = false;
</script>

<svelte:window on:click={() => (menu = false)} />

{#if $wallet.address && $privateAccount.step === 'READY'}
  <div
    on:click={(e) => e.stopPropagation()}
    class="absolute right-0 bg-gray-900 bg-opacity-80 z-10">
    <div class="flex items-center">
      <span class="text-yellow-300 font-black pr-4">
        {#if $playTokenAccount.balance}
          {'' + $playTokenAccount.balance
              .div('10000000000000000')
              .toNumber() / 100 + '\u00A0$'}
        {:else}...&nbsp;${/if}
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
      on:click={(e) => e.stopPropagation()}
      class="absolute z-10 right-0 top-14 border-cyan-500 border-2 p-5 bg-opacity-80 bg-black flex mr-2 flex-col items-center">
      <NavButton class="m-1" label="withdrawals" href="withdrawals">
        Withdrawals
      </NavButton>
      <PanelButton class="m-1" label="Disconnect" on:click={disconnect}>
        Disconnect
      </PanelButton>
    </div>
  {/if}
{:else}
  <div class="absolute right-0 bg-gray-900 bg-opacity-80">
    <PanelButton class="m-1" label="Connect" on:click={connect}>
      Connect
      <!-- <Help inverted={true} class="w-4 h-4">
      Hello d
      <span class="text-red-500">s dsads ad</span>sdas dWorld!
    </Help> -->
    </PanelButton>
  </div>
{/if}
