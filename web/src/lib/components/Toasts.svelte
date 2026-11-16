<script lang="ts">
	import { page } from '$app/state';
	import { Mascot } from 'warren/burrow';
	import { flip, fly, haptic, spring } from 'warren/web';
	import { toasts } from '../state.svelte.ts';

	// Stacked just above the nav (and Bao's message button on day screens), newest at the bottom; centred on the
	// page beside the rail. Each flies up into place and drops away, and the others slide to make room.
	const onDay = $derived(page.url.pathname.startsWith('/day'));
	const onLogin = $derived(page.url.pathname.startsWith('/login'));
</script>

<div
	class="pointer-events-none fixed z-50 flex flex-col items-center gap-2 px-4"
	style="left: {onLogin ? '0px' : 'var(--rail-w)'}; right: var(--fold-right); bottom: calc(env(safe-area-inset-bottom) + {onLogin ? '16px' : `var(--dock-h) + ${onDay ? 'var(--message-h) + 16px' : '16px'}`})"
	aria-live="polite"
>
	{#each toasts.items as toast (toast.id)}
		<div
			class="bh-toast mk-toast pointer-events-auto w-full max-w-md"
			role="status"
			animate:flip
			in:fly={{ y: 24, duration: 380, easing: spring }}
			out:fly={{ y: 16, duration: 200 }}
		>
			<span class="bh-toast__bub">
				<Mascot character={toast.character ?? 'bao'} mood={toast.mood ?? (toast.action ? 'happy' : 'joy')} size={40} />
			</span>
			<span class="bh-toast__text">{toast.message}</span>
			{#if toast.action}
				<button
					class="bh-btn wn-press bh-btn--ghost"
					onclick={async () => {
						const action = toast.action;
						toasts.dismiss(toast.id);
						haptic('select');
						await action?.run();
					}}>{toast.action.label}</button
				>
			{/if}
		</div>
	{/each}
</div>
