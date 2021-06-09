<script lang="ts">
  import claimFlow from '$lib/flows/claim';
  import sendFlow from '$lib/flows/send';
  import simulateFlow from '$lib/flows/simulateFlow';
  import exitFlow from '$lib/flows/exit';
  import messageFlow from '$lib/flows/message';
  import showPlanetDepartures from '$lib/flows/showPlanetDepartures';
  import {wallet} from '$lib/blockchain/wallet';
  import privateAccount from '$lib/account/privateAccount';
  import Help from '$lib/components/utils/Help.svelte';
  import PlayCoin from '$lib/components/utils/PlayCoin.svelte';
  import PanelButton from '$lib/components/generic/PanelButton.svelte';
  import {spaceInfo} from '$lib/space/spaceInfo';
  import {planets} from '$lib/space/planets';

  export let coords: {x: number; y: number};
  export let close: () => void;

  $: planetInfo = spaceInfo.getPlanetInfo(coords.x, coords.y);

  $: planetState = planets.planetStateFor(planetInfo);

  function capture() {
    claimFlow.claim(coords);
  }

  function sendTo() {
    sendFlow.sendTo(coords);
    close();
  }

  function sendFrom() {
    sendFlow.sendFrom(coords);
    close();
  }

  function cancelSend() {
    sendFlow.cancel();
  }

  function simulateFrom() {
    simulateFlow.simulateFrom(coords);
    close();
  }

  function showSimulation() {
    simulateFlow.simulate(coords);
  }

  function cancelSimulation() {
    simulateFlow.cancel();
  }

  function exitFrom() {
    exitFlow.exitFrom(coords);
    close();
  }

  function messageOwner() {
    messageFlow.show($planetState.owner);
  }

  function showDepartures() {
    showPlanetDepartures.show(planetInfo.location.id);
  }

  function connect() {
    privateAccount.login();
  }

  $: walletIsOwner = $wallet.address && $wallet.address?.toLowerCase() === $planetState?.owner?.toLowerCase();
  $: textColor =
    $planetState && $planetState.owner ? (walletIsOwner ? 'text-green-500' : 'text-red-500') : 'text-gray-100';

  $: destinationPlanetInfo =
    $sendFlow.data?.to && spaceInfo.getPlanetInfo($sendFlow.data?.to.x as number, $sendFlow.data?.to.y as number);
  $: destinationPlanetState = $sendFlow.data?.to && planets.planetStateFor(destinationPlanetInfo);

  $: originPlanetInfo =
    $sendFlow.data?.from && spaceInfo.getPlanetInfo($sendFlow.data?.from.x as number, $sendFlow.data?.from.y as number);
  $: originPlanetState = $sendFlow.data?.from && planets.planetStateFor(originPlanetInfo);

  $: attacking =
    $sendFlow.step === 'PICK_ORIGIN' && destinationPlanetState && $destinationPlanetState?.owner !== $wallet.address;

  $: captureResult = undefined; // TODO $planetState ? space.simulateCapture($wallet.address, $planet, $time) : undefined;
</script>

{#if $planetState}
  {#if $wallet.address}
    {#if !!$planetState?.capturing}
      {#if $planetState.capturing === 'Loading'}
        <p>Please wait....</p>
      {:else if $planetState.capturing.status === 'Failure'}
        <p>The Capture Transaction Failed.</p>
        <p class="p-2">
          See
          <a
            target="_blank"
            class="underline text-cyan-100"
            href={`${import.meta.env.VITE_BLOCK_EXPLORER_TRANSACTION}${$planetState.capturing.txHash}`}>here</a
          >
        </p>
        <PanelButton
          label="Ok"
          class="m-2"
          color="text-green-500"
          borderColor="border-green-500"
          on:click={() => privateAccount.acknowledgeCaptureFailure(planetInfo.location.id)}
        >
          <div class="w-20">Ok</div>
        </PanelButton>
      {:else}
        <p>Capturing....</p>
      {/if}
    {:else if $sendFlow.step === 'PICK_DESTINATION'}
      {#if planetInfo.location.id === (originPlanetInfo ? originPlanetInfo.location.id : null)}
        <p class="m-3">Pick a Different Planet than Itself</p>
      {:else if !$planetState.owner}
        <!-- SEND TO CONQUERE -->
        <PanelButton label="Attack!" class="m-2" color="text-red-500" borderColor="border-red-500" on:click={sendTo}>
          <div class="w-20">
            Attack!
            <Help class="inline w-4 h-4">
              You can attack other planets by sending spaceships to them. Once it reaches destination, you ll have to
              resolve the attack.
            </Help>
          </div>
        </PanelButton>
      {:else if walletIsOwner && !$planetState.active}
        <!-- SEND MORE -->
        <PanelButton
          label="Send Reinforcment"
          class="m-2"
          color="text-green-500"
          borderColor="border-green-500"
          on:click={sendTo}
        >
          <div class="w-20">Send Reinforcment</div>
        </PanelButton>
      {:else if walletIsOwner}
        <!-- SEND PROTECTION -->
        <PanelButton
          label="Send Reinforcment"
          class="m-2"
          color="text-green-500"
          borderColor="border-green-500"
          on:click={sendTo}
        >
          <div class="w-20">Send Reinforcment</div>
        </PanelButton>
      {:else}
        <!-- ATTACK -->
        <PanelButton label="Attack!" class="m-2" color="text-red-500" borderColor="border-red-500" on:click={sendTo}>
          <div class="w-20">
            Attack!
            <Help class="inline w-4 h-4">
              You can attack other planets by sending spaceships to them. Once it reaches destination, you ll have to
              resolve the attack.
            </Help>
          </div>
        </PanelButton>
      {/if}
      <PanelButton label="Cancel" class="m-2" on:click={cancelSend}>
        <div class="w-20">Cancel</div>
      </PanelButton>
    {:else if $sendFlow.step === 'PICK_ORIGIN'}
      {#if planetInfo.location.id === (destinationPlanetInfo ? destinationPlanetInfo.location.id : null)}
        <p class="m-3">Pick a Different Planet than Itself</p>
      {:else if !$planetState.owner}
        <!-- SEND TO CONQUERE -->
        <p class="m-3">Pick a Planet you own.</p>
      {:else if walletIsOwner && $planetState.exiting}
        <!-- SEND TO CONQUERE -->
        <p class="m-3">This Planet is exiting, pick another one</p>
      {:else if walletIsOwner && !$planetState.active}
        {#if $planetState.numSpaceships == 0}
          <p class="m-3">Pick a Planet with spaceships.</p>
        {:else}
          <!-- SEND MORE -->
          {#if attacking}
            <PanelButton
              label="Send Attack!"
              class="m-2"
              color="text-red-500"
              borderColor="border-red-500"
              on:click={sendFrom}
            >
              <div class="w-20">
                Send Attack!
                <Help class="inline w-4 h-4">
                  You can attack other planets by sending spaceships to them. Once it reaches destination, you ll have
                  to resolve the attack.
                </Help>
              </div>
            </PanelButton>
          {:else}
            <PanelButton
              label="Send Reinforcment"
              class="m-2"
              color="text-green-500"
              borderColor="border-green-500"
              on:click={sendFrom}
            >
              <div class="w-20">Send Reinforcment</div>
            </PanelButton>
          {/if}
        {/if}
      {:else if walletIsOwner}
        <!-- SEND PROTECTION -->
        {#if attacking}
          <PanelButton
            label="Send Attack!"
            class="m-2"
            color="text-red-500"
            borderColor="border-red-500"
            on:click={sendFrom}
          >
            <div class="w-20">
              Send Attack!
              <Help class="inline w-4 h-4">
                You can attack other planets by sending spaceships to them. Once it reaches destination, you ll have to
                resolve the attack.
              </Help>
            </div>
          </PanelButton>
        {:else}
          <PanelButton
            label="Send Reinforcment"
            class="m-2"
            color="text-green-500"
            borderColor="border-green-500"
            on:click={sendFrom}
          >
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
    {:else if $simulateFlow.step === 'PICK_DESTINATION'}
      <PanelButton
        label="Show simulation"
        class="m-2"
        color="text-green-500"
        borderColor="border-green-500"
        on:click={showSimulation}
      >
        <div class="w-20">Show Simulation</div>
      </PanelButton>

      <PanelButton label="Cancel" class="m-2" on:click={cancelSimulation}>
        <div class="w-20">Cancel</div>
      </PanelButton>
    {:else if !$planetState.owner}
      <PanelButton
        label="Capture"
        class="m-2"
        color="text-yellow-400"
        borderColor="border-yellow-400"
        disabled={!$planetState.inReach}
        on:click={capture}
      >
        <div class="w-20">
          Capture
          <span class="text-sm">
            {#if !$planetState.inReach}
              (unreachable)
              <Help class="inline w-4 h-4">
                The Reachable Universe expands as more planets get captured. Note though that you can still send attack
                unreachable planets. But these planets cannot produce spaceships until they get in range and you stake
                on it.
              </Help>
            {:else}
              <Help class="inline w-4 h-4">
                To capture a planet and make it produce spaceships for you, you have to deposit a certain number of
                <PlayCoin class="w-4 inline" />
                (Play token) on it. If you lose your planet, you lose the ability to withdraw them.
                <br />
                The capture will be resolved as if it was a 10,000 attack power with 100,000
                <!-- TODO config -->
                spaceships. The capture will only be succesful if the attack succeed
              </Help>
            {/if}
          </span>
        </div>
      </PanelButton>
      {#if $planetState.natives}
        <PanelButton label="Attack" class="m-2" color="text-red-500" borderColor="border-red-500" on:click={sendTo}>
          <div class="w-20">
            Attack
            <Help class="inline w-4 h-4">
              You can attack other planets by sending spaceships to them. Once it reaches destination, you ll have to
              resolve the attack.
            </Help>
          </div>
        </PanelButton>
      {:else}
        <!-- unreachable ? -->
        <PanelButton label="Send Spaceships Here" class="m-2" on:click={sendTo}>
          <div class="w-20">Send Spaceships Here</div>
        </PanelButton>
      {/if}
    {:else if walletIsOwner && $planetState.exiting}
      <PanelButton label="Request Reinforcment" class="m-2" on:click={sendTo}>
        <div class="w-20">Request Reinforcment</div>
      </PanelButton>
    {:else if walletIsOwner && !$planetState.active}
      <PanelButton
        label="Capture"
        class="m-2"
        color="text-yellow-400"
        borderColor="border-yellow-400"
        disabled={!$planetState.inReach}
        on:click={capture}
      >
        <div class="w-20">
          Capture
          <span class="text-sm">
            {!$planetState.inReach ? ' (unreachable)' : ''}
            <Help class="inline w-4 h-4">
              The Reachable Universe expands as more planets get captured. Note though that you can still send attack
              unreachable planets. But these planets cannot produce spaceships until they get in range and you stake on
              it.
            </Help></span
          >
        </div>
      </PanelButton>
      <PanelButton label="Request Reinforcment" class="m-2" on:click={sendTo}>
        <div class="w-20">Request Reinforcment</div>
      </PanelButton>
      {#if $planetState.numSpaceships > 0}
        <PanelButton label="Send Fleet" class="m-2" on:click={sendFrom}>
          <div class="w-20">Send Fleet</div>
        </PanelButton>
      {/if}
    {:else if walletIsOwner}
      <PanelButton label="Request Reinforcment" class="m-2" on:click={sendTo}>
        <div class="w-20">Request Reinforcment</div>
      </PanelButton>
      <PanelButton label="Send Fleet" class="m-2" on:click={sendFrom}>
        <div class="w-20">Send Fleet</div>
      </PanelButton>
      <PanelButton label="Exit" color="text-yellow-400" borderColor="border-yellow-400" class="m-2" on:click={exitFrom}>
        <div class="w-20">Exit</div>
      </PanelButton>
    {:else}
      <PanelButton label="Attack" class="m-2" color="text-red-500" borderColor="border-red-500" on:click={sendTo}>
        <div class="w-20">
          Attack
          <Help class="inline w-4 h-4">
            You can attack other planets by sending spaceships to them. Once it reaches destination, you ll have to
            resolve the attack.
          </Help>
        </div>
      </PanelButton>
      {#if !$planetState.active}
        <PanelButton
          label="Capture"
          class="m-2"
          color="text-yellow-400"
          borderColor="border-yellow-400"
          disabled={!$planetState.inReach || !captureResult.success}
          on:click={capture}
        >
          <div class="w-20">
            Capture
            <span class="text-sm">
              {#if !$planetState.inReach}
                (unreachable)
                <Help class="inline w-4 h-4">
                  The Reachable Universe expands as more planets get captured. Note though that you can still send
                  attack unreachable planets. But these planets cannot produce spaceships until they get in range and
                  you stake on it.
                </Help>
              {:else if !captureResult.success}
                <Help class="inline w-4 h-4">
                  <!-- The planet cannot be captured at the moment as it has too strong defense -->
                  To capture a planet, it first need to be either without spaceships or controlled by you.
                </Help>
              {:else}
                <Help class="inline w-4 h-4">
                  To capture a planet and make it produce spaceships for you, you have to deposit a certain number of
                  <PlayCoin class="w-4 inline" />
                  (Play token) on it. If you lose your planet, you lose the ability to withdraw them.
                  <br />
                  The capture will be resolved as if it was a 10,000 attack power with 100,000
                  <!-- TODO config -->
                  spaceships. The capture will only be succesful if the attack succeed
                </Help>
              {/if}
            </span>
          </div>
        </PanelButton>
      {/if}
      <PanelButton
        label="Message"
        color="text-blue-400"
        borderColor="border-blue-400"
        class="m-2"
        on:click={messageOwner}
      >
        <div class="w-20">Message Owner</div>
      </PanelButton>
      <PanelButton
        label="Simulate"
        color="text-gray-200"
        borderColor="border-gray-200"
        class="m-2"
        on:click={simulateFrom}
      >
        <div class="w-20">Simulate Attack</div>
      </PanelButton>
    {/if}
    <PanelButton
      label="Departures"
      color="text-gray-200"
      borderColor="border-gray-200"
      class="m-2"
      on:click={showDepartures}
    >
      <div class="w-20">Enemy Fleets</div>
    </PanelButton>
  {:else}
    <PanelButton label="Connect your wallet" class="m-2" on:click={connect}>
      <div class="w-20">Connect Wallet</div>
    </PanelButton>
  {/if}
{:else}Loading...{/if}
