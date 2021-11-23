<script>
  import '../service-worker-handler';
  import '../global.css';
  import Notifications from '$lib/components/notification/Notifications.svelte';
  import NoInstallPrompt from '$lib/components/web/NoInstallPrompt.svelte';
  import NewVersionNotification from '$lib/components/web/NewVersionNotification.svelte';
  import {initDebug} from '$lib/utils/debug';
  import {onMount} from 'svelte';
  // import Install from './components/Install.svelte';
  onMount(() => {
    initDebug();
  });
</script>

<svelte:head>
  <title>conquest.eth, An unstoppable game of strategy and diplomacy running on Ethereum</title>
</svelte:head>

<NoInstallPrompt />
<NewVersionNotification />

<slot />
<Notifications />
