<script lang="ts">
  import {Router, CurrentPage} from './lib/routing';
  import routes from './routes/_.routes';
  // import Navbar from './components/navigation/Navbar.svelte';
  import Navigating from './lib/routing/curi/Navigating.svelte';
  import Loading from './components/Loading.svelte';
  import Notifications from './components/notification/Notifications.svelte';
  import NoInstallPrompt from './components/NoInstallPrompt.svelte';
  import NewVersionNotification from './components/NewVersionNotification.svelte';
  // import Install from './components/Install.svelte';

  // import LogWidget from './components/LogWidget.svelte';
  // import logs from './stores/logs';
  // window.addEventListener('unhandledrejection', function (
  //   event: PromiseRejectionEvent
  // ) {
  //   if (typeof event.reason === 'string') {
  //     logs.add(event.reason);
  //   } else {
  //     if (typeof event.reason.message) {
  //       logs.add(event.reason.message);
  //     } else {
  //       logs.add(event.reason.toString());
  //     }
  //   }
  // });
</script>

<!-- disable prompt -->
<NoInstallPrompt />
<NewVersionNotification />
<Router
  {routes}
  globalQueryStrings={['subgraph', 'debug', 'log', 'trace', 'sync', '_d_eruda']}>
  <Notifications />
  <!-- <Navbar links={['Home', 'Wallet']} /> -->
  <CurrentPage>
    <Loading />
  </CurrentPage>
  <Navigating component={Loading} />
</Router>

<!-- <div class="z-50 fixed bottom-0 right-0 w-3/5 h-3/5"> -->
<!-- <iframe
    src="https://discord.com/widget?id=807666878427299880&theme=dark"
    width="350"
    height="500"
    allowtransparency="true"
    frameborder="0"
    sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts" /> -->
<!-- <iframe
    class="w-full h-full"
    src="https://titanembeds.com/embed/807666878427299880?defaultchannel=810560458888839238"
    frameborder="0" /> -->
<!-- </div> -->
<!-- <LogWidget /> -->
