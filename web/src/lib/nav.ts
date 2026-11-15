import type { Tab } from 'warren/web';
import type { IconName } from './burrow/Icon.svelte';
import { session } from './state.svelte.ts';

/** The main screens, shared by the bottom nav on phones and the side rail on desktop. */
export const NAV_ITEMS: { href: () => string; label: string; match: (p: string) => boolean; icon: IconName }[] = [
	{ href: () => (session.me ? `/day/${session.me.today}` : '/'), label: 'Today', match: (p) => p === '/' || p.startsWith('/day'), icon: 'home' },
	{ href: () => '/foods', label: 'Foods', match: (p) => p.startsWith('/foods'), icon: 'bowl' },
	{ href: () => '/history', label: 'History', match: (p) => p.startsWith('/history'), icon: 'calendar' },
	{ href: () => '/settings', label: 'Settings', match: (p) => p.startsWith('/settings'), icon: 'gear' }
];

/** The nav's own screens, which cross-fade into each other; anything else (a food) slides in over them. */
export const TABS: Tab[] = [(p) => p === '/' || p.startsWith('/day/'), '/foods', '/history', '/settings'];

export function isTab(path: string): boolean {
	const clean = path.replace(/\/+$/, '') || '/';
	return TABS.some((tab) => (typeof tab === 'string' ? tab === clean : tab(clean)));
}

/** Day screens put Bao over the message button instead, so there is one peek per screen. */
export function navPeek(path: string): boolean {
	return !path.startsWith('/day');
}
