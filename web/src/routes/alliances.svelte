<script lang="ts">
  import {base} from '$app/paths';

  import Blockie from '$lib/components/account/Blockie.svelte';
  import NavButton from '$lib/components/navigation/NavButton.svelte';

  import Loading from '$lib/components/web/Loading.svelte';
  import {playersQuery} from '$lib/space/playersQuery';
  import {url} from '$lib/utils/url';

  // TODO SHare this in _layout ?
  import messageFlow from '$lib/flows/message';
  import MessageFlow from '$lib/flows/MessageFlow.svelte';
  import PanelButton from '$lib/components/generic/PanelButton.svelte';
  import {Wallet} from '@ethersproject/wallet';
  import {flow, wallet} from '$lib/blockchain/wallet';
  import {hexZeroPad} from '@ethersproject/bytes';
  import Help from '$lib/components/utils/Help.svelte';

  async function create() {
    await flow.execute(async (contracts) => {
      const salt = Wallet.createRandom().privateKey;
      const deterministicAddress = await contracts.BasicAllianceFactory.getAddress(salt);
      // TODO allow multiple members at creation
      const message = `Join Alliance ${hexZeroPad(deterministicAddress.toLowerCase(), 20)}`;
      const signature = await wallet.provider.getSigner().signMessage(message);
      await contracts.BasicAllianceFactory.instantiate(
        wallet.address,
        [{addr: wallet.address, nonce: 0, signature}],
        salt
      );
    });
  }
</script>

<NavButton label="Back To Game" href={`${base}/`}>Back To Game</NavButton>

<div>
  <div>
    <PanelButton on:click={create} label="Create"
      >Create Your Alliance <Help class="w-6 h-6"
        >While you can create alliances any way you like (they are just smart contract), for the alpha, we let you
        create BasicAlliance right here, that have an admin riole that can add new member but cannot remove them. If you
        want more complex alliances, you ll need to code them.</Help
      ></PanelButton
    >
  </div>
</div>

<h2 class="m-4 text-green-600 text-xl">Current Alliances:</h2>
{#if !$playersQuery || !$playersQuery.data || $playersQuery.step === 'LOADING'}
  <p>Loading...</p>
{:else}
  <div>
    <ul class="m-2">
      <hr />
      {#each Object.entries($playersQuery.data.alliances) as entry}
        <li>
          <h3 class="text-xl text-yellow-500">
            <Blockie class="inline w-10 h-10 m-1" address={entry[0]} /> Alliance {entry[0]}
          </h3>
          <a
            target="_blank"
            class="inline-block border-2 border-yellow-400 p-1 m-1"
            href={url(`external/basic-alliances/`, `id=${entry[0]}`)}>JOIN/MANAGE</a
          >
          <p>members:</p>
          <ul class="m-2">
            {#each entry[1].members as member}
              <li>
                <Blockie class="w-6 h-6 m-1 inline" address={member.address} />{member.address} (<button
                  class="underline"
                  on:click={() => messageFlow.show(member.address)}>contact</button
                >)
              </li>
            {/each}
          </ul>
          <hr />
        </li>
      {/each}
    </ul>
  </div>
{/if}

<!-- TODO share that in _layout ? -->
{#if $messageFlow.error || $messageFlow.step !== 'IDLE'}
  <MessageFlow />
{/if}
