<script lang="ts">
  import {Router, CurrentPage} from './lib/routing';
  import pages from './pages';
  // import Navbar from './components/navigation/Navbar.svelte';
  import Navigating from './lib/routing/curi/Navigating.svelte';
  import Loading from './components/Loading.svelte';
  import Notifications from './components/notification/Notifications.svelte';
</script>

<Router {pages} globalQueryStrings={['subgraph', 'debug', 'log', 'trace']}>
  <Notifications />
  <!-- <Navbar links={['Home', 'Wallet']} /> -->
  <CurrentPage>
    <Loading />
    Loading...
  </CurrentPage>
  <Navigating component={Loading} />
</Router>
