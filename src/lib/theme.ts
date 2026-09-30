import { browser } from '$app/environment';

/**
 * The pre-paint surface-theme cache.
 *
 * This is *not* where the setting lives. A signed-in person's colour mode is on
 * their account (`lib/appearance.svelte.ts`), which is one round trip away — too
 * long to wait before the first paint without flashing a white page at somebody
 * who chose dark. So the resolved mode is mirrored here, the inline script in
 * the root layout reads it before anything renders, and the account overwrites
 * it as soon as it answers.
 */
const STORAGE_KEY = 'orderly-theme';

export type ThemeMode =
	| 'light'
	| 'soft'
	| 'mist'
	| 'dark'
	| 'graphite'
	| 'raw'
	| 'night'
	| 'midnight';

const VALID: ThemeMode[] = [
	'light',
	'soft',
	'mist',
	'dark',
	'graphite',
	'raw',
	'night',
	'midnight'
];

export function resolveInitialTheme(): ThemeMode {
	if (!browser) return 'light';
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored && (VALID as string[]).includes(stored)) return stored as ThemeMode;
	} catch {
		/* blocked storage — fall through to the system preference */
	}
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Mirror the resolved mode for the next first paint. */
export function rememberTheme(mode: ThemeMode) {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, mode);
	} catch {
		/* the account still has the truth */
	}
}

/**
 * Paint the cached mode.
 *
 * Only for surfaces with no account behind them — the customer storefront and
 * the signed-out screens. A console calls this on the way in and is then
 * corrected by the appearance it loads.
 */
export function initTheme() {
	if (!browser) return;
	document.documentElement.dataset.theme = resolveInitialTheme();
}
