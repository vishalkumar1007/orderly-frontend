import { storefrontAdminApi, type AdminStorefront } from '$lib/storefront/admin';

export type { AdminStorefront };

/**
 * In-memory cache for the storefront admin configuration document.
 *
 * Leaving storefront for SMTP/Storage and coming back remounts the layout.
 * Without a cache that remount always starts with loading=true and a full-pane
 * skeleton. Serve the last document immediately and refresh in the background.
 */
let cached = $state<AdminStorefront | null>(null);
let inflight: Promise<AdminStorefront> | null = null;

export function getStorefrontAdmin(): AdminStorefront | null {
	return cached;
}

export function setStorefrontAdmin(config: AdminStorefront | null): void {
	cached = config;
}

export function invalidateStorefrontAdmin(): void {
	cached = null;
}

/**
 * Load the storefront admin document, sharing one inflight request.
 * When `force` is true, always hits the network (and updates the cache).
 */
export function loadStorefrontAdmin(force = false): Promise<AdminStorefront> {
	if (!force && cached) return Promise.resolve(cached);
	if (!force && inflight) return inflight;

	const p = storefrontAdminApi
		.get()
		.then((config) => {
			cached = config;
			return config;
		})
		.finally(() => {
			if (inflight === p) inflight = null;
		});

	inflight = p;
	return p;
}
