<script lang="ts">
	import { page } from '$app/state';
	import Icon from '../burrow/Icon.svelte';
	import { NAV_ITEMS, navPeek } from '../nav.ts';
	import { Peek } from 'warren/burrow';
	import { slidingPill } from 'warren/web';
	import { toasts } from '../state.svelte.ts';

	const path = $derived(page.url.pathname);
	const peek = $derived(navPeek(path));
</script>

{#snippet nav()}
	<nav class="bh-nav" aria-label="Main" {@attach slidingPill()}>
		{#each NAV_ITEMS as item (item.label)}
			{@const active = item.match(path)}
			<a href={item.href()} class="bh-nav__item wn-press {active ? 'is-active' : ''}" aria-current={active ? 'page' : undefined}>
				<span class="bh-nav__pill"><Icon name={item.icon} size={22} /></span>
				<span class="bh-nav__label">{item.label}</span>
			</a>
		{/each}
	</nav>
{/snippet}

<!-- phones and tablets: desktop has the side rail. Half-folded, it keeps to the left of the fold.
     It holds still while the screen above it changes (data-wn-keep), and slides away while a toast takes its place. -->
<div data-wn-keep="dock" class="mk-dock {toasts.current ? 'is-away' : ''} pointer-events-none fixed bottom-0 left-0 z-30 px-4 lg:hidden" style="right: var(--fold-right); padding-bottom: calc(env(safe-area-inset-bottom) + var(--nav-gap))">
	<div class="mx-auto max-w-lg">
		<!-- one nav for every screen, so its pill can slide; on day screens Bao ducks behind it -->
		<Peek character="bao" size={56} side="left" offset={20} class={peek ? '' : 'mk-peek--away'}>{@render nav()}</Peek>
	</div>
</div>

<style>
	.mk-dock :global(.bh-nav) {
		pointer-events: auto;
	}

	.mk-dock {
		transition:
			transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1),
			visibility 0s;
	}

	/* under the toast, out of reach, Bao and all */
	.mk-dock.is-away {
		transform: translateY(calc(100% + 64px));
		visibility: hidden;
		transition:
			transform 0.22s ease-in,
			visibility 0s 0.22s;
	}

	@media (prefers-reduced-motion: reduce) {
		.mk-dock,
		.mk-dock.is-away {
			transition: none;
		}
	}
</style>
