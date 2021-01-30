<script lang="ts">
  import PanelButton from './PanelButton.svelte';
  import {wallet} from '../stores/wallet';
  import {playTokenAccount} from '../stores/playToken';
  import privateAccount from '../stores/privateAccount';
  import Blockie from './Blockie.svelte';

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
  <div on:click={(e) => e.stopPropagation()}>
    <span class="flex flex-row-reverse" on:click={() => (menu = !menu)}>
      <Blockie class="w-10 h-10 m-1" address={$wallet.address} />
      {#if $playTokenAccount.balance}
        <span
          class="text-yellow-300">{$playTokenAccount.balance
            .div('10000000000000000')
            .toNumber() / 100}</span>
      {/if}
    </span>

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
      <PanelButton class="m-1" label="Disconnect" on:click={disconnect}>
        Disconnect
      </PanelButton>
    {/if}
  </div>
{:else}
  <PanelButton class="m-1" label="Connect" on:click={connect}>
    Connect
  </PanelButton>
{/if}
