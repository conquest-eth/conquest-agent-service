<script lang="ts">
  import IFramePlugin from './IFramePlugin.svelte';
  // TODO use plugin list
  const pluginList =
    typeof window !== 'undefined'
      ? [
          {
            name: 'Basic Spaceship Marketplace',
            iframe: 'http://localhost:3001',
            config: {
              actions: [
                {
                  title: 'Market',
                  action: 'show_planet',
                  panelConditions: ['owner', 'planet:basic_sale'],
                  mapConditions: ['planet:basic_sale'],
                },
              ],
            },
          },
        ]
      : [];
</script>

{#each pluginList as plugin}
  <IFramePlugin title={plugin.name} src={plugin.iframe} pluginConfig={plugin.config} />
{/each}
