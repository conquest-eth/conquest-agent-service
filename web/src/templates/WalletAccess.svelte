<script lang="ts">
  export let title: string = '';
  import NavButton from '../components/navigation/NavButton.svelte';
  import Button from '../components/PanelButton.svelte';
  import Modal from '../components/Modal.svelte';

  import {
    wallet,
    builtin,
    chain,
    transactions,
    balance,
    flow,
  } from '../stores/wallet';

  import privateAccount from '../stores/privateAccount';

  const chainNames: {[chainId: string]: string} = {
    '1': 'mainnet',
    '3': 'ropsten',
    '4': 'rinkeby',
    '5': 'goerli',
    '42': 'kovan',
    '1337': 'localhost chain',
    '31337': 'localhost chain',
  };
  const chainId: string = import.meta.env.SNOWPACK_PUBLIC_CHAIN_ID;
  const chainName = (() => {
    const name = chainNames[chainId];
    if (name) {
      return name;
    }
    return `chain with id ${chainId}`;
  })();

  const base: string = window.basepath || '/';

  $: executionError = $flow.executionError as any;

  let options: {img: string; id: string; name: string}[] = [];
  $: builtinNeedInstalation =
    $wallet.options.filter((v) => v === 'builtin' && !$builtin.available)
      .length > 0;
  $: options = $wallet.options
    .filter((v) => v !== 'builtin' || $builtin.available)
    .map((v) => {
      return {
        img: ((v) => {
          if (v === 'builtin') {
            if ($builtin.state === 'Ready') {
              if ($builtin.vendor === 'Metamask') {
                return 'images/metamask.svg';
              } else if ($builtin.vendor === 'Opera') {
                return 'images/opera.svg';
              }
            }
            return 'images/web3-default.png';
          } else {
            if (v.startsWith('torus-')) {
              const verifier = v.slice(6);
              return `images/torus/${verifier}.svg`;
            }
            return `images/${v}.svg`;
          }
        })(v),
        id: v,
        name: v,
      };
    });

  let storeSignatureLocally = false;
  let syncRemotely = true;
</script>

<slot />

{#if $flow.inProgress}
  <Modal
    {title}
    cancelable={!$wallet.connecting}
    on:close={() => flow.cancel()}
    closeButton={false}>
    {#if $wallet.state === 'Idle'}
      {#if $wallet.loadingModule}
        Loading module:
        {$wallet.selected}
      {:else if $wallet.connecting}
        Connecting to wallet...
      {:else}
        <div class="text-center">
          <p>You need to connect your wallet.</p>
        </div>
        <div class="flex flex-wrap justify-center pb-3">
          {#each options as option}
            <img
              class="cursor-pointer p-2 m-2 border-2 h-12 w-12 object-contain border-cyan-300"
              alt={`Login with ${option.name}`}
              src={`${base}${option.img}`}
              on:click={() => wallet.connect(option.id)} />
          {/each}
        </div>
        {#if builtinNeedInstalation}
          <div class="text-center">OR</div>
          <div class="flex justify-center">
            <NavButton
              label="Download Metamask"
              blank={true}
              href="https://metamask.io/download.html"
              class="m-4 w-max-content">
              <img
                class="cursor-pointer p-0 m-auto h-10 w-10 object-contain"
                alt={`Download Metamask}`}
                src={`${base}images/metamask.svg`} />
              Download metamask
            </NavButton>
          </div>
        {/if}
      {/if}
    {:else if $wallet.state === 'Locked'}
      {#if $wallet.unlocking}
        Please accept the application to access your wallet.
      {:else}
        <Button label="Unlock Wallet" on:click={() => wallet.unlock()}>
          Unlock
        </Button>
      {/if}
    {:else if $chain.state === 'Idle'}
      {#if $chain.connecting}Connecting...{/if}
    {:else if $chain.state === 'Connected'}
      {#if $chain.loadingData}
        Loading contracts...
      {:else if $chain.notSupported}Please switch to {chainName}{/if}
    {:else if $wallet.pendingUserConfirmation}
      {#if $wallet.pendingUserConfirmation[0] === 'transaction'}
        Please accept transaction...
      {:else if $wallet.pendingUserConfirmation[0] === 'signature'}
        Please accept signature...
      {:else}Please accept request...{/if}
    {:else if $privateAccount.step === 'SIGNATURE_REQUIRED'}
      <div class="text-center">
        <p>
          Planet Wars require your signature to operate. Do not sign this
          message outside of Planet Wars!
        </p>
        <!-- TODO store and then auto connect if present -->
        <div class="ml-8 mt-6 text-cyan-100 text-xs">
          <label class="flex items-center">
            <input
              type="checkbox"
              class="form-checkbox"
              bind:checked={storeSignatureLocally} />
            <span class="ml-2">Do not ask again. (trust computer and
              {window.location.host})</span>
          </label>
          <label class="flex items-center">
            <input
              type="checkbox"
              class="form-checkbox"
              bind:checked={syncRemotely} />
            <span class="ml-2">enable encrypted sync across devices</span>
          </label>
        </div>
        <Button
          label="sign"
          class="mt-5"
          on:click={() => privateAccount.confirm({
              storeSignatureLocally,
              syncRemotely,
            })}>
          sign
        </Button>
      </div>
    {:else if $privateAccount.step === 'LOADING'}
      Loading Data...
    {:else if executionError}
      <div class="text-center">
        <p>
          {#if executionError.code === 4001}
            You rejected the request
          {:else if executionError.message}
            {executionError.message}
          {:else}Error: {executionError}{/if}
        </p>
        <Button class="mt-4" label="Retry" on:click={() => flow.retry()}>
          Retry
        </Button>
      </div>
    {/if}
  </Modal>
{/if}
