import { MediaQuery } from 'svelte/reactivity';
import { Session, Toasts } from 'warren/web';
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

/** One toast at a time, in the nav's place: a new one replaces the one on show, and warren/burrow's `Toast` times it (5 s, stopped while held). */
export const toasts = new Toasts<ToastLook>({ defaults: {}, onError: { tone: 'error', character: 'kayu', mood: 'worried' }, max: 1, timed: false });
