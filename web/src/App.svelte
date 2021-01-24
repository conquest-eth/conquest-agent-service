<script lang="ts">
  import {Router, CurrentPage} from './lib/routing';
  import routes from './routes/_.routes';
  // import Navbar from './components/navigation/Navbar.svelte';
  import Navigating from './lib/routing/curi/Navigating.svelte';
  import Loading from './components/Loading.svelte';
  import Notifications from './components/notification/Notifications.svelte';
</script>

<Router {routes} globalQueryStrings={['subgraph', 'debug', 'log', 'trace']}>
  <Notifications />
  <!-- <Navbar links={['Home', 'Wallet']} /> -->
  <CurrentPage>
    <Loading />
    Loading...
  </CurrentPage>
  <Navigating component={Loading} />
</Router>
