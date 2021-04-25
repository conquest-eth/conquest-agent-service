<script lang="ts">
  import NavButton from '$lib/components/navigation/NavButton.svelte';
  import {base} from '$app/paths';
  import {wallet, builtin, flow} from '$lib/stores/wallet';
  import privateAccount from '$lib/stores/privateAccount';
  import myprofile from '$lib/stores/myprofile';
  import {BigNumber} from '@ethersproject/bignumber';
  import WalletAccess from '$lib/WalletAccess.svelte';
  import Button from '$lib/components/PanelButton.svelte';
  import {base64} from '$lib/utils';

  // TODO remove duplication, abstract away profile sync but also sync in general
  const PROFILE_URI = import.meta.env.VITE_PROFILE_URI as string;
  const DB_NAME = 'etherplay-profile';

  async function getProfile(walletAddress: string) {
    // TODO request signature, etc...

    const response = await fetch(PROFILE_URI, {
      method: 'POST',
      body: JSON.stringify({
        method: 'wallet_getString',
        params: [walletAddress, DB_NAME],
        jsonrpc: '2.0',
        id: 99999999, // TODO ?
      }),
      headers: {
        'Content-type': 'application/json; charset=UTF-8',
      },
    });
    const json = await response.json();
    const result = json.result;
    // TODO check signature
    let parsedData = undefined;
    if (result.data && result.data !== '') {
      parsedData = JSON.parse(result.data);
      if (Object.keys(parsedData).length === 0) {
        parsedData = undefined; // an empty profile is the equivalent of no profile
      }
    }
    if (parsedData === undefined) {
      parsedData = {};
    }

    const counter = BigNumber.from(result.counter).add(1).toString();

    return {counter, currentData: parsedData};
  }

  async function setProfile(e: Event) {
    const walletAddress = $wallet.address;
    const {counter, currentData} = await getProfile(walletAddress);
    currentData.name = name;
    currentData.contact = contact;
    const {publicKey} = $privateAccount.messagingKey;
    var publicKeyString = base64.bytesToBase64(publicKey);
    currentData.publicKey = publicKeyString;
    const data = JSON.stringify(currentData);

    const signature = await wallet.provider.getSigner().signMessage('put:' + DB_NAME + ':' + counter + ':' + data);
    await fetch(PROFILE_URI, {
      method: 'POST',
      body: JSON.stringify({
        method: 'wallet_putString',
        params: [walletAddress, DB_NAME, counter, data, signature],
        jsonrpc: '2.0',
        id: 99999999, // TODO ?
      }),
      headers: {
        'Content-type': 'application/json; charset=UTF-8',
      },
    });
  }

  let name: string | undefined;
  let contact: string | undefined;

  $: {
    if (!name) {
      name = $myprofile.profile?.name;
    }
    if (!contact) {
      contact = $myprofile.profile?.contact;
    }
  }
</script>

<div class="w-full h-full bg-black">
  <NavButton label="Back To Game" href={`${base}/`}>Back To Game</NavButton>

  <WalletAccess>
    {#if $privateAccount.step !== 'READY'}
      <Button
        class="w-max-content m-4"
        label="connect"
        disabled={$privateAccount.step !== 'IDLE'}
        on:click={() => privateAccount.login()}>
        <!-- TODO privateAccount so we can get access to the public key-->
        Connect
      </Button>
    {:else}
      <form class="space-y-8 divide-y divide-gray-200 text-white">
        <div class="space-y-8 divide-y divide-gray-200 sm:space-y-5">
          <div>
            <div>
              <h3 class="text-lg leading-6 font-medium">Profile</h3>
            </div>

            <div class="mt-6 sm:mt-5 space-y-6 sm:space-y-5 text-gray-200">
              <div class="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label for="name" class="block text-sm font-medium sm:mt-px sm:pt-2"> Name </label>
                <div class="mt-1 sm:mt-0 sm:col-span-2">
                  <div class="max-w-lg flex rounded-md shadow-sm">
                    <input
                      bind:value={name}
                      type="text"
                      name="name"
                      id="name"
                      autocomplete="off"
                      class="flex-1 block w-full focus:ring-indigo-500 focus:border-indigo-500 min-w-0 rounded-none rounded-r-md sm:text-sm border-gray-300 bg-gray-700" />
                  </div>
                </div>
              </div>

              <div class="sm:grid sm:grid-cols-3 sm:gap-4 sm:items-start sm:border-t sm:border-gray-200 sm:pt-5">
                <label for="Contact" class="block text-sm font-medium sm:mt-px sm:pt-2"> Contact </label>
                <div class="mt-1 sm:mt-0 sm:col-span-2">
                  <textarea
                    bind:value={contact}
                    id="contact"
                    name="contact"
                    rows="3"
                    class="max-w-lg shadow-sm block w-full focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border-gray-300 rounded-md  bg-gray-700" />
                  <p class="mt-2 text-sm">Describe how other players can contact you.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
      <div class="pt-5">
        <div class="flex justify-end">
          <!-- <button
          type="button"
          class="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
          Cancel
        </button> -->
          <button
            on:click={setProfile}
            class="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            Save
          </button>
        </div>
      </div>
    {/if}
  </WalletAccess>
</div>
