<script lang="ts">
	import '@fontsource/fredoka/latin-600.css';
	import '@fontsource/figtree/latin-400.css';
	import '@fontsource/figtree/latin-600.css';
	import './layout.css';
	import { page } from '$app/state';
	import { afterNavigate, goto, onNavigate } from '$app/navigation';
	import { Loader, Toast } from 'warren/burrow';
	import { configureApi, configureData, direction, pageTransition, swipeBack } from 'warren/web';
	import BottomNav from '#lib/components/BottomNav.svelte';
	import SideNav from '#lib/components/SideNav.svelte';
	import { TABS, isTab } from '#lib/nav.ts';
	import { session, toasts } from '#lib/state.svelte.ts';
	import { onMount } from 'svelte';

	let { children } = $props();
	let ready = $state(false);
	const isLogin = $derived(page.url.pathname.startsWith('/login'));

	configureApi({ onUnauthorized: () => goto('/login') });
	configureData({ onError: (err) => toasts.error(err) });

	// Whether the screen on show was seen a moment ago: gone back to, or reached through the browser's own
	// back and forward. Not reactive on purpose: `returned` below reads it when the address changes, which is
	// when the new screen mounts.
	let again = false;
	// How many screens deep this tab is in the app, for swiping back.
	let depth = 0;

	// Screens change like a native app's (warren/web's pageTransition; motion.css and layout.css say how):
	// the nav's screens cross-fade, a food slides in over Foods and back out again, and the nav and Bao's
	// message button hold still. One day to another is the same screen, so it skips this and the day slides
	// over by itself.
	onNavigate((navigation) => {
		if (navigation.from?.route.id === navigation.to?.route.id) return;
		again = navigation.type === 'popstate' || direction(navigation, TABS) === 'back';
		return pageTransition(navigation, { tabs: TABS });
	});

	afterNavigate((navigation) => {
		if (navigation.type === 'enter') depth = 0;
		else if (navigation.type === 'popstate') depth = Math.max(0, depth + (navigation.delta ?? -1));
		else if (navigation.from?.route.id !== navigation.to?.route.id) depth++;
	});

	// A screen gone back to is already known: its cards don't rise in again (the motion section of layout.css).
	// It holds for the screen's life, so nothing replays when the transition ends.
	const returned = $derived.by(() => {
		void page.url;
		return again;
	});

	onMount(async () => {
		// a tapped reminder asks the open app to show its day (see the service worker)
		navigator.serviceWorker?.addEventListener('message', (event) => {
			if (event.data?.type === 'open' && typeof event.data.url === 'string') goto(event.data.url);
		});
		if (isLogin) {
			ready = true;
			return;
		}
		const me = await session.load();
		if (!me) {
			await goto('/login', { replace: true });
		}
		ready = true;
	});
</script>

<!-- the one toast, in the docked nav's place (BottomNav slides away underneath); beside the rail, at the foot of the content column -->
<Toast
	{toasts}
	style="left: {isLogin ? '0px' : 'var(--rail-w)'}; right: var(--fold-right); padding: 0 16px calc(env(safe-area-inset-bottom) + var(--nav-gap))"
/>

{#if isLogin}
	{@render children()}
{:else if ready && session.me}
	<div class="overflow-x-clip lg:flex">
		<SideNav />
		<!-- phones: one column with room underneath for the floating nav and Bao peeking over it;
		     unfolded foldables and tablets: the full width, for the screens' columns; desktop: a wider column beside the rail.
		     A screen below the nav's own follows a swipe in from the left edge back to where it came from. -->
		<main
			class="mx-auto min-h-dvh w-full max-w-lg min-w-0 bg-paper pb-[calc(env(safe-area-inset-bottom)+var(--dock-h)+64px)] sm:max-w-none lg:max-w-6xl lg:px-8 lg:pt-6 {returned
				? 'mk-returned'
				: ''}"
			{@attach swipeBack({ canGoBack: () => depth > 0 && !isTab(location.pathname) })}
		>
			{@render children()}
		</main>
	</div>
	<BottomNav />
{:else}
	<div class="grid min-h-dvh place-items-center">
		<Loader kind="crumbs" />
	</div>
{/if}
