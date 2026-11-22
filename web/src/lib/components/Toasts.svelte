<script lang="ts">
	import { page } from '$app/state';
	import { Mascot } from 'warren/burrow';
	import { fly, haptic } from 'warren/web';
	import { prefersReducedMotion } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { TOAST_MS, toasts } from '../state.svelte.ts';

	/* Burrow's Toast takes the docked nav's place, at its width and height, for 5 s; the nav slides away underneath
	   (BottomNav.svelte) and comes back when it goes. Beside the side rail it sits at the bottom of the content column
	   at the phone nav's width. One at a time: a new one replaces it. Swipe it left, right or down to dismiss: it
	   follows the finger, and past 64px or on a flick it carries on off that way; otherwise it springs back. The
	   timer stops while it's held. */
	const onLogin = $derived(page.url.pathname.startsWith('/login'));
	const toast = $derived(toasts.current);

	const FAR = 64;
	const FLICK = 0.5; // px per ms

	let left = $state(1); // time left, 1 to 0
	let dx = $state(0);
	let dy = $state(0);
	let held = $state(false);
	let settling = $state(false);
	// which way the last one went, for its way out
	let away = { x: 0, y: 0 };

	// The timer: a fresh 5 s for each toast, counted only while nobody holds it.
	$effect(() => {
		const id = toast?.id;
		if (id == null) return;
		left = 1;
		dx = dy = 0;
		away = { x: 0, y: 0 };
		let last = performance.now();
		let frame = requestAnimationFrame(function step(now) {
			if (!held) left = Math.max(0, left - (now - last) / TOAST_MS);
			last = now;
			if (left <= 0) toasts.dismiss(id);
			else frame = requestAnimationFrame(step);
		});
		return () => cancelAnimationFrame(frame);
	});

	let start: { x: number; y: number; t: number; axis: 'x' | 'y' | null } | null = null;
	let lastMove = { x: 0, y: 0, t: 0 };

	function down(e: PointerEvent) {
		if ((e.target as Element).closest('button')) return;
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
		start = { x: e.clientX, y: e.clientY, t: e.timeStamp, axis: null };
		lastMove = { x: e.clientX, y: e.clientY, t: e.timeStamp };
		held = true;
		settling = false;
	}

	function move(e: PointerEvent) {
		if (!start) return;
		const mx = e.clientX - start.x;
		const my = e.clientY - start.y;
		if (!start.axis && Math.hypot(mx, my) > 6) start.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
		// sideways it moves freely; up it barely gives, down it follows
		dx = start.axis === 'x' ? mx : 0;
		dy = start.axis === 'y' ? (my > 0 ? my : my / 6) : 0;
		lastMove = { x: e.clientX, y: e.clientY, t: e.timeStamp };
	}

	function up(e: PointerEvent, id: number) {
		if (!start) return;
		const dt = Math.max(1, e.timeStamp - lastMove.t + 16);
		const vx = (e.clientX - lastMove.x) / dt;
		const vy = (e.clientY - lastMove.y) / dt;
		const axis = start.axis;
		start = null;
		held = false;
		if (axis === 'x' && (Math.abs(dx) > FAR || Math.abs(vx) > FLICK)) {
			dismiss(id, { x: Math.sign(dx || vx), y: 0 });
		} else if (axis === 'y' && (dy > FAR || vy > FLICK)) {
			dismiss(id, { x: 0, y: 1 });
		} else {
			settling = true;
			dx = dy = 0;
		}
	}

	function dismiss(id: number, way: { x: number; y: number }) {
		away = way;
		haptic('tap');
		toasts.dismiss(id);
	}

	// Its way out: off the way it was swiped, from where the finger left it; otherwise it drops back behind the nav.
	function leave(node: HTMLElement) {
		if (prefersReducedMotion.current) return { duration: 0 };
		const from = { x: dx, y: dy };
		const width = node.offsetWidth + 32;
		const to = away.x ? { x: away.x * width, y: 0 } : { x: 0, y: away.y ? node.offsetHeight + 40 : 24 };
		return {
			duration: away.x || away.y ? 220 : 200,
			easing: cubicOut,
			css: (t: number, u: number) =>
				`--toast-dx: ${from.x + (to.x - from.x) * u}px; --toast-dy: ${from.y + (to.y - from.y) * u}px; opacity: ${away.x || away.y ? 1 : t}`
		};
	}
</script>

<div
	class="mk-toasts pointer-events-none fixed bottom-0 z-40 px-4"
	style="left: {onLogin ? '0px' : 'var(--rail-w)'}; right: var(--fold-right); padding-bottom: calc(env(safe-area-inset-bottom) + var(--nav-gap))"
	aria-live="polite"
>
	<div class="mx-auto grid max-w-lg">
		{#each toasts.items as t (t.id)}
			<div
				class="bh-toast mk-toast pointer-events-auto {settling ? 'is-settling' : ''}"
				role="status"
				style="--toast-dx: {dx}px; --toast-dy: {dy}px"
				onpointerdown={down}
				onpointermove={move}
				onpointerup={(e) => up(e, t.id)}
				onpointercancel={(e) => up(e, t.id)}
				ontransitionend={() => (settling = false)}
				in:fly={{ y: 40, duration: 320, opacity: 0 }}
				out:leave
			>
				<Mascot character={t.character ?? 'bao'} mood={t.mood ?? (t.action ? 'happy' : 'joy')} size={40} class="bh-toast__who" />
				<span class="bh-toast__text">{t.message}</span>
				{#if t.action}
					<button
						class="bh-btn wn-press"
						onclick={async () => {
							const action = t.action;
							away = { x: 0, y: 0 };
							toasts.dismiss(t.id);
							haptic('select');
							await action?.run();
						}}>{t.action.label}</button
					>
				{/if}
				<span class="bh-toast__time" style="width: {left * 100}%" aria-hidden="true"></span>
			</div>
		{/each}
	</div>
</div>

<style>
	/* a new toast and the one it replaces share the spot while one goes and the other comes */
	.mk-toasts .bh-toast {
		grid-area: 1 / 1;
	}

	/* let go short of the mark: it springs back */
	.is-settling {
		transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@media (prefers-reduced-motion: reduce) {
		.is-settling {
			transition: none;
		}
	}
</style>
