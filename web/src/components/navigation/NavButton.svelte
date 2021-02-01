<script>
  import InnerButton from './InnerButton.svelte';
  import {getRouter} from '@curi/svelte';
  import {createEventDispatcher} from 'svelte';

  let class_names: string = '';
  export {class_names as class};
  export let label: string;

  export let params = {};
  export let state: any = null;

  export let href: string | undefined = undefined;
  export let blank: boolean = false;
  export let type: string | undefined = undefined;

  let router = getRouter();
  let canNavigate = (event: MouseEvent, target: Element) => {
    return (
      !event.defaultPrevented &&
      !target &&
      event.button === 0 &&
      !(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
    );
  };

  let url: string;
  let target: Element;
  let handlePageLink: (e: MouseEvent) => void;
  $: {
    if (href && !href.startsWith('http')) {
      const split1 = href.split('#');
      const split2 = split1[0].split('?');
      const page = split2[0];
      const hash = split1[1];
      const query = split2[1];
      url = router.url({name: page, params, hash, query});
      target = $$restProps.target;
      handlePageLink = (event) => {
        if (canNavigate(event, target)) {
          event.preventDefault();
          router.navigate({url: url === '' ? '/' : url, state}); // TODO check / rules here
        }
      };
    } else {
      url = href as string;
    }
  }
</script>

<div class="inline-block text-cyan-300 border-cyan-300 {class_names}">
  {#if href}
    <div class="relative p-1 text-cyan-300 border-cyan-300">
      <a
        aria-label={label}
        title={label}
        href={url}
        rel={blank === true ? 'noopener noreferrer' : ''}
        target={blank === true ? '_blank' : ''}
        on:click={handlePageLink}>
        <InnerButton>
          <slot />
        </InnerButton>
      </a>
    </div>
  {:else}
    <button {label} class="relative p-1 text-cyan-300 border-cyan-300">
      <InnerButton>
        <slot />
      </InnerButton>
    </button>
  {/if}
</div>
