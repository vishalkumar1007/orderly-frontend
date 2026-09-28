import { getStorefrontAdminOrDefault } from '$lib/storefront/adminCache.svelte';
import type { PageLoad } from './$types';

/**
 * Client-only: the staff JWT lives in localStorage, so a server render resolves
 * nobody. Returning the cached document (or a safe default) means the section
 * rail and the form chrome paint immediately and the page fills in after.
 */
export const ssr = false;

export const load: PageLoad = async () => {
	return {
		storefront: getStorefrontAdminOrDefault(),
		storefrontError: null as string | null
	};
};
