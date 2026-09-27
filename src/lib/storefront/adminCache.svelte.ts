import {
	createDefaultStorefront,
	isDefaultStorefront,
	storefrontAdminApi,
	type AdminStorefront
} from '$lib/storefront/admin';

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
/** True only after a successful server load — blocks saves from placeholder defaults. */
let fromServer = $state(false);

export function getStorefrontAdmin(): AdminStorefront | null {
	return cached;
}

export function getStorefrontAdminOrDefault(): AdminStorefront {
	return cached ?? createDefaultStorefront();
}

export function hasLiveStorefrontAdmin(): boolean {
	return fromServer && cached !== null && !isDefaultStorefront(cached);
}

export function setStorefrontAdmin(config: AdminStorefront | null): void {
	cached = config;
	if (config && !isDefaultStorefront(config)) fromServer = true;
}

export function invalidateStorefrontAdmin(): void {
	cached = null;
	inflight = null;
	fromServer = false;
}

/**
 * Load the storefront admin document.
 * - Cache hit returns immediately unless `force`.
 * - One shared in-flight request for non-force callers.
 * - Hard timeout so navigation UI is never blocked forever.
 */
export function loadStorefrontAdmin(force = false): Promise<AdminStorefront> {
	if (!force && cached && fromServer) return Promise.resolve(cached);
	if (!force && inflight) return inflight;

	const TIMEOUT_MS = 3_500;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const request = storefrontAdminApi.get();
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => {
			reject(
				new Error('Storefront is taking too long to load. Check that the API is running and try again.')
			);
		}, TIMEOUT_MS);
	});

	const p = Promise.race([request, timeout])
		.then((config) => {
			cached = config;
			fromServer = true;
			return config;
		})
		.finally(() => {
			if (timer) clearTimeout(timer);
			if (inflight === p) inflight = null;
		});

	inflight = p;
	return p;
}

/**
 * Ensure a live server document is available before writing.
 * Prevents overwriting a real shop with `createDefaultStorefront()` placeholders.
 */
export async function ensureLiveStorefrontAdmin(): Promise<AdminStorefront> {
	if (hasLiveStorefrontAdmin() && cached) return cached;
	return loadStorefrontAdmin(true);
}
