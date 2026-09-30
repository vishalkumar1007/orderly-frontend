import { getContext } from 'svelte';

const KEY = Symbol('storefront-theme-toggle');

export type StorefrontThemeToggle = {
	enabled: boolean;
	mode: 'light' | 'dark';
	toggle: () => void;
};

export function setStorefrontThemeToggle(value: StorefrontThemeToggle) {
	// StoreRoot calls this via setContext in the component file.
	return value;
}

export const STOREFRONT_THEME_TOGGLE_KEY = KEY;

export function useStorefrontThemeToggle(): StorefrontThemeToggle | null {
	return getContext<StorefrontThemeToggle | null>(KEY) ?? null;
}
