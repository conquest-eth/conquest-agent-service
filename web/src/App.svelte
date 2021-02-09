<script lang="ts">
  import {Router, CurrentPage} from './lib/routing';
  import routes from './routes/_.routes';
  // import Navbar from './components/navigation/Navbar.svelte';
  import Navigating from './lib/routing/curi/Navigating.svelte';
  import Loading from './components/Loading.svelte';
  import Notifications from './components/notification/Notifications.svelte';
  import NoInstallPrompt from './components/NoInstallPrompt.svelte';
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
<Router {routes} globalQueryStrings={['subgraph', 'debug', 'log', 'trace']}>
  <Notifications />
  <!-- <Navbar links={['Home', 'Wallet']} /> -->
  <CurrentPage>
    <Loading />
  </CurrentPage>
  <Navigating component={Loading} />
</Router>

<!-- <LogWidget /> -->
