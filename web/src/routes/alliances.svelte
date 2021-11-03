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
</script>

<NavButton label="Back To Game" href={`${base}/`}>Back To Game</NavButton>

{#if !$playersQuery || !$playersQuery.data || $playersQuery.step === 'LOADING'}
  <p>Loading...</p>
{:else}
  <div>
    <ul class="m-2">
      {#each Object.entries($playersQuery.data.alliances) as entry}
        <li>
          <h3 class="text-xl text-yellow-500">
            <Blockie class="inline w-10 h-10 m-1" address={entry[0]} /> Alliance {entry[0]} (<a
              target="_blank"
              class="underline"
              href={url(`external/basic-alliances/`, `id=${entry[0]}`)}>website</a
            >)
          </h3>
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
        </li>
      {/each}
    </ul>
  </div>
{/if}

<!-- TODO share that in _layout ? -->
{#if $messageFlow.error || $messageFlow.step !== 'IDLE'}
  <MessageFlow />
{/if}
