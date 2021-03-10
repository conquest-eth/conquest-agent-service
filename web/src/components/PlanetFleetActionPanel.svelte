<script lang="ts">
  import claimFlow from '../stores/claim';
  import sendFlow from '../stores/send';
  import exitFlow from '../stores/exit';
  import {wallet} from '../stores/wallet';
  import privateAccount from '../stores/privateAccount';
  import {planetAt} from '../stores/planets';
  import Help from './Help.svelte';

  import PanelButton from './PanelButton.svelte';
  import {locationToXY, xyToLocation} from '../common/src';

  export let location: string;
  export let close: () => void;

  const planet = planetAt(location);

  function capture() {
    claimFlow.claim(location);
  }

  function sendTo() {
    sendFlow.sendTo(locationToXY(location));
    close();
  }

  function sendFrom() {
    sendFlow.sendFrom(locationToXY(location));
    close();
  }

  function cancelSend() {
    sendFlow.cancel();
  }

  function exitFrom() {
    exitFlow.exitFrom(locationToXY(location));
    close();
  }

  function connect() {
    privateAccount.login();
  }

  $: walletIsOwner =
    $wallet.address &&
    $wallet.address?.toLowerCase() === $planet.state?.owner.toLowerCase();
  $: textColor =
    $planet.state &&
    $planet.state.owner !== '0x0000000000000000000000000000000000000000'
      ? walletIsOwner
        ? 'text-green-500'
        : 'text-red-500'
      : 'text-gray-100';

  $: destinationPlanet =
    $sendFlow.data?.to &&
    planetAt(
      xyToLocation(
        $sendFlow.data?.to.x as number,
        $sendFlow.data?.to.y as number
      )
    );

  $: originPlanet =
    $sendFlow.data?.from &&
    planetAt(
      xyToLocation(
        $sendFlow.data?.from.x as number,
        $sendFlow.data?.from.y as number
      )
    );
  $: attacking =
    $sendFlow.step === 'PICK_ORIGIN' &&
    destinationPlanet &&
    $destinationPlanet.state?.owner !== $wallet.address;
</script>

{#if $planet.state}
  {#if $wallet.address}
    {#if !!$planet.state?.capturing}
      {#if $planet.state.capturing === 'Loading'}
        <p>Please wait....</p>
      {:else if $planet.state.capturing.status === 'Failure'}
        <p>The Capture Transaction Failed.</p>
        <p class="p-2">
          See
          <a
            target="_blank"
            class="underline text-cyan-100"
            href={`${import.meta.env.SNOWPACK_PUBLIC_BLOCK_EXPLORER}/${$planet.state.capturing.txHash}`}>here</a>
        </p>
        <PanelButton
          label="Ok"
          class="m-2"
          color="text-green-500"
          borderColor="border-green-500"
          on:click={() => privateAccount.acknowledgeCaptureFailure($planet.location.id)}>
          <div class="w-20">Ok</div>
        </PanelButton>
      {:else}
        <p>Capturing....</p>
      {/if}
    {:else if $sendFlow.step === 'PICK_DESTINATION'}
      {#if $planet.location.id === (originPlanet ? $originPlanet.location.id : null)}
        <p class="m-3">Pick a Different Planet than Itself</p>
      {:else if $planet.state.owner === '0x0000000000000000000000000000000000000000'}
        <!-- SEND TO CONQUERE -->
        <PanelButton
          label="Attack!"
          class="m-2"
          color="text-red-500"
          borderColor="border-red-500"
          on:click={sendTo}>
          <div class="w-20">
            Attack!
            <Help class="inline w-4 h-4">
              You can attack other planets by sending spaceships to them. Once
              it reaches destination, you ll have to resolve the attack.
            </Help>
          </div>
        </PanelButton>
      {:else if walletIsOwner && !$planet.state.active}
        <!-- SEND MORE -->
        <PanelButton
          label="Send Hre"
          class="m-2"
          color="text-green-500"
          borderColor="border-green-500"
          on:click={sendTo}>
          <div class="w-20">Request Reinforcment</div>
        </PanelButton>
      {:else if walletIsOwner}
        <!-- SEND PROTECTION -->
        <PanelButton
          label="Send To"
          class="m-2"
          color="text-green-500"
          borderColor="border-green-500"
          on:click={sendTo}>
          <div class="w-20">Request Reinforcment</div>
        </PanelButton>
      {:else}
        <!-- ATTACK -->
        <PanelButton
          label="Attack!"
          class="m-2"
          color="text-red-500"
          borderColor="border-red-500"
          on:click={sendTo}>
          <div class="w-20">
            Attack!
            <Help class="inline w-4 h-4">
              You can attack other planets by sending spaceships to them. Once
              it reaches destination, you ll have to resolve the attack.
            </Help>
          </div>
        </PanelButton>
      {/if}
      <PanelButton label="Cancel" class="m-2" on:click={cancelSend}>
        <div class="w-20">Cancel</div>
      </PanelButton>
    {:else if $sendFlow.step === 'PICK_ORIGIN'}
      {#if $planet.location.id === (destinationPlanet ? $destinationPlanet.location.id : null)}
        <p class="m-3">Pick a Different Planet than Itself</p>
      {:else if $planet.state.owner === '0x0000000000000000000000000000000000000000'}
        <!-- SEND TO CONQUERE -->
        <p class="m-3">Pick a Planet you own.</p>
      {:else if walletIsOwner && $planet.state.exiting}
        <!-- SEND TO CONQUERE -->
        <p class="m-3">This Planet is exiting, pick another one</p>
      {:else if walletIsOwner && !$planet.state.active}
        <!-- SEND MORE -->
        {#if attacking}
          <PanelButton
            label="Attack!"
            class="m-2"
            color="text-red-500"
            borderColor="border-red-500"
            on:click={sendFrom}>
            <div class="w-20">
              Attack!
              <Help class="inline w-4 h-4">
                You can attack other planets by sending spaceships to them. Once
                it reaches destination, you ll have to resolve the attack.
              </Help>
            </div>
          </PanelButton>
        {:else}
          <PanelButton
            label="Send Reinforcment"
            class="m-2"
            color="text-green-500"
            borderColor="border-green-500"
            on:click={sendFrom}>
            <div class="w-20">Send Reinforcment</div>
          </PanelButton>
        {/if}
      {:else if walletIsOwner}
        <!-- SEND PROTECTION -->
        {#if attacking}
          <PanelButton
            label="Attack!"
            class="m-2"
            color="text-red-500"
            borderColor="border-red-500"
            on:click={sendFrom}>
            <div class="w-20">
              Attack!
              <Help class="inline w-4 h-4">
                You can attack other planets by sending spaceships to them. Once
                it reaches destination, you ll have to resolve the attack.
              </Help>
            </div>
          </PanelButton>
        {:else}
          <PanelButton
            label="Send Reinforcment"
            class="m-2"
            color="text-green-500"
            borderColor="border-green-500"
            on:click={sendFrom}>
            <div class="w-20">Send Reinforcment</div>
          </PanelButton>
        {/if}
      {:else}
        <!-- ATTACK -->
        <p class="m-3">Pick a Planet you own.</p>
      {/if}
      <PanelButton label="Cancel" class="m-2" on:click={cancelSend}>
        <div class="w-20">Cancel</div>
      </PanelButton>
    {:else if $planet.state.owner === '0x0000000000000000000000000000000000000000'}
      <PanelButton
        label="Capture"
        class="m-2"
        color="text-yellow-400"
        borderColor="border-yellow-400"
        disabled={!$planet.state.inReach}
        on:click={capture}>
        <div class="w-20">
          Capture
          <span class="text-sm">
            {!$planet.state.inReach ? ' (unreachable)' : ''}
            <Help class="inline w-4 h-4">
              The Reachable Universe expands as more planets get captured. Note
              though that you can still send attack unreachable planets. But
              these planets cannot produce spaceships until they get in range
              and you stake on it.
            </Help></span>
        </div>
      </PanelButton>
      {#if $planet.state.natives}
        <PanelButton
          label="Attack"
          class="m-2"
          color="text-red-500"
          borderColor="border-red-500"
          on:click={sendTo}>
          <div class="w-20">
            Attack
            <Help class="inline w-4 h-4">
              You can attack other planets by sending spaceships to them. Once
              it reaches destination, you ll have to resolve the attack.
            </Help>
          </div>
        </PanelButton>
      {:else}
        <!-- unreachable ? -->
        <PanelButton label="Send Spaceships Here" class="m-2" on:click={sendTo}>
          <div class="w-20">Send Spaceships Here</div>
        </PanelButton>
      {/if}
    {:else if walletIsOwner && $planet.state.exiting}
      <PanelButton label="Request Reinforcment" class="m-2" on:click={sendTo}>
        <div class="w-20">Request Reinforcment</div>
      </PanelButton>
    {:else if walletIsOwner && !$planet.state.active}
      <PanelButton
        label="Capture"
        class="m-2"
        disabled={!$planet.state.inReach}
        on:click={capture}>
        <div class="w-20">
          Capture
          <span class="text-sm">
            {!$planet.state.inReach ? ' (unreachable)' : ''}
            <Help class="inline w-4 h-4">
              The Reachable Universe expands as more planets get captured. Note
              though that you can still send attack unreachable planets. But
              these planets cannot produce spaceships until they get in range
              and you stake on it.
            </Help></span>
        </div>
      </PanelButton>
      <PanelButton label="Request Reinforcment" class="m-2" on:click={sendTo}>
        <div class="w-20">Request Reinforcment</div>
      </PanelButton>
      <PanelButton label="Send Fleet" class="m-2" on:click={sendFrom}>
        <div class="w-20">Send Fleet</div>
      </PanelButton>
    {:else if walletIsOwner}
      <PanelButton label="Request Reinforcment" class="m-2" on:click={sendTo}>
        <div class="w-20">Request Reinforcment</div>
      </PanelButton>
      <PanelButton label="Send Fleet" class="m-2" on:click={sendFrom}>
        <div class="w-20">Send Fleet</div>
      </PanelButton>
      <PanelButton
        label="Exit"
        color="text-yellow-400"
        borderColor="border-yellow-400"
        class="m-2"
        on:click={exitFrom}>
        <div class="w-20">Exit</div>
      </PanelButton>
    {:else}
      <PanelButton
        label="Attack"
        class="m-2"
        color="text-red-500"
        borderColor="border-red-500"
        on:click={sendTo}>
        <div class="w-20">
          Attack
          <Help class="inline w-4 h-4">
            You can attack other planets by sending spaceships to them. Once it
            reaches destination, you ll have to resolve the attack.
          </Help>
        </div>
      </PanelButton>
    {/if}
  {:else}
    <PanelButton label="Connect your wallet" class="m-2" on:click={connect}>
      <div class="w-20">Connect Wallet</div>
    </PanelButton>
  {/if}
{:else}Loading...{/if}
