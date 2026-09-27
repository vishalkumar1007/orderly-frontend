import { getStorefrontAdminOrDefault } from '$lib/storefront/adminCache.svelte';
import type { LayoutLoad } from './$types';

/**
 * Client-only: staff JWT lives in localStorage.
 * Load returns immediately (cached config if any, or safe default) so navigation
 * never waits on the network. The layout fetches/refreshes after paint.
 */
export const ssr = false;

export const load: LayoutLoad = async () => {
	return {
		storefront: getStorefrontAdminOrDefault(),
		storefrontError: null as string | null
	};
};
