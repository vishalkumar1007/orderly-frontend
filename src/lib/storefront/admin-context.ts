/**
 * The shape the storefront control layout shares with its screens.
 *
 * It lives here rather than in the layout component because a Svelte component
 * cannot export a type from its instance script in a way a child page can
 * import.
 *
 * The context is deliberately narrow. A screen gets the configuration, a
 * `save` helper that writes and then re-reads, and a `refresh`. It cannot mutate
 * the document directly, so what a screen shows always matches what the server
 * actually stored — including when a write was rejected.
 */
import { untrack } from 'svelte';
import type { AdminStorefront } from './admin';

export type StorefrontContext = {
	config: AdminStorefront;
	/** Runs a write, replaces the shared document with the server's answer, and
	 *  reports whether it succeeded. */
	save: (run: () => Promise<AdminStorefront>) => Promise<boolean>;
	refresh: () => Promise<void>;
};

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
