import { browser } from '$app/environment';

const STORAGE_KEY = 'orderly-theme';

export type ThemeMode = 'light' | 'dark';

export function resolveInitialTheme(): ThemeMode {
	if (!browser) return 'light';
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'light' || stored === 'dark') return stored;
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(mode: ThemeMode) {
	if (!browser) return;
	document.documentElement.dataset.theme = mode;
	localStorage.setItem(STORAGE_KEY, mode);
}

export function toggleTheme(current: ThemeMode): ThemeMode {
	const next = current === 'light' ? 'dark' : 'light';
	applyTheme(next);
	return next;
}

export function initTheme() {
	applyTheme(resolveInitialTheme());
}
