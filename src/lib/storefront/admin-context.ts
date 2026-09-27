/**
 * The shape the storefront control layout shares with its screens.
 *
 * It lives here rather than in the layout component because a Svelte component
 * cannot export a type from its instance script in a way a child page can
 * import.
 *
 * SvelteKit layouts render child pages without forwarding snippet arguments,
 * so screens receive this context via Svelte's context API (setStorefrontContext /
 * useStorefront) with fallback to default storefront configs.
 */
import { getContext, setContext, untrack } from 'svelte';
import type { AdminStorefront } from './admin';
import { getStorefrontAdminOrDefault } from './adminCache.svelte';

export const STOREFRONT_CTX_KEY = Symbol('storefront-context');

export type StorefrontContext = {
	config: AdminStorefront;
	/** Runs a write, replaces the shared document with the server's answer, and
	 *  reports whether it succeeded. */
	save: (run: () => Promise<AdminStorefront>) => Promise<boolean>;
	refresh: () => Promise<void>;
};

export function setStorefrontContext(ctx: StorefrontContext): void {
	setContext(STOREFRONT_CTX_KEY, ctx);
}

export function getStorefrontContext(): StorefrontContext {
	const ctx = getContext<StorefrontContext | undefined>(STOREFRONT_CTX_KEY);
	if (ctx) return ctx;
	return {
		get config() {
			return getStorefrontAdminOrDefault();
		},
		save: async () => false,
		refresh: async () => {}
	};
}

export function useStorefront(getProps?: () => Partial<StorefrontContext> | undefined): StorefrontContext {
	const ctx = getStorefrontContext();
	return {
		get config() {
			const p = typeof getProps === 'function' ? getProps() : getProps;
			return p?.config ?? ctx.config ?? getStorefrontAdminOrDefault();
		},
		get save() {
			const p = typeof getProps === 'function' ? getProps() : getProps;
			return p?.save ?? ctx.save;
		},
		get refresh() {
			const p = typeof getProps === 'function' ? getProps() : getProps;
			return p?.refresh ?? ctx.refresh;
		}
	};
}

/**
 * `seed` captures a value from the loaded configuration once, for a form field
 * the user then edits.
 *
 * `config` is a reactive value that the layout replaces after every successful
 * write, so reading it directly into `$state` would silently look like it tracks
 * the server — and a customer's unsaved edit would vanish on the next save.
 * Seeding once is the behaviour these screens want, and `untrack` says so out
 * loud instead of leaving it to a reader to work out.
 */
export function seed<T>(read: () => T): T {
	return untrack(read);
}
