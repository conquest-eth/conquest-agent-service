import preprocess from 'svelte-preprocess';
import adapter_ipfs from 'sveltejs-adapter-ipfs';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: preprocess({
    sourceMap: true,
  }),

  kit: {
    adapter: adapter_ipfs({
      removeSourceMap: true,
      copyBeforeSourceMapRemoval: 'release',
      removeBuiltInServiceWorkerRegistration: true,
      injectPagesInServiceWorker: true,
      injectDebugConsole: true,
    }),
    target: '#svelte',
    trailingSlash: 'ignore',
    vite: {
      build: {
        sourcemap: true,
      },
    },
  },
};

export default config;
