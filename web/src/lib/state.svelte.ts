import { MediaQuery } from 'svelte/reactivity';
import { Session, Toasts, type Toast, type ToastAction } from 'warren/web';
import type { Me } from './types.ts';
import type { Character, Mood } from 'warren/burrow';

/** Who is signed in. Warren's session, loaded once from /api/me. */
export const session = new Session<Me>();

/** Wide enough for screens to lay out in columns (Tailwind's sm): unfolded foldables, tablets and desktops. */
export const columns = new MediaQuery('min-width: 640px', false);

/** Desktop and laptop widths, where the side rail replaces the bottom nav and Bao's message button moves into Today's left column (Tailwind's lg). */
export const wide = new MediaQuery('min-width: 1024px', false);

/** A half-folded screen in book posture: two viewport segments side by side (Tailwind's `book:`). */
export const book = new MediaQuery('horizontal-viewport-segments: 2', false);

/** What a toast shows besides its message: the animal, by job (Bao for food, the default; Kayu for settings, saving and errors), and its mood. */
export interface ToastLook {
	tone?: 'info' | 'error';
	character?: Character;
	mood?: Mood;
}

/** How long a toast stays, not counting while a finger holds it. */
export const TOAST_MS = 5000;

/**
 * One toast at a time, in the nav's place: a new one replaces the one on show. Toasts.svelte times it (5 s, paused
 * while held), so `show` sets no timer of its own and ignores `ms`.
 */
class BaoToasts extends Toasts<ToastLook> {
	#next = 0;

	override show(message: string, options: Partial<ToastLook> & { action?: ToastAction | null; ms?: number } = {}): number {
		const { action = null, ms: _ms, ...look } = options;
		const id = ++this.#next;
		this.items = [{ ...look, id, message, action } as Toast<ToastLook>];
		return id;
	}
}

export const toasts = new BaoToasts({ defaults: {}, onError: { tone: 'error', character: 'kayu', mood: 'worried' } });
