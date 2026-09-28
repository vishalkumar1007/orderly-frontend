import { getStorefrontAdminOrDefault } from '$lib/storefront/adminCache.svelte';
import type { LayoutLoad } from './$types';

/**
 * Organization ops screens (hours, payments, workflow) need the same storefront
 * admin document as Customize. Return defaults instantly so navigation never waits.
 */
export const ssr = false;

export const load: LayoutLoad = async () => {
	return {
		storefront: getStorefrontAdminOrDefault(),
		storefrontError: null as string | null
	};
};
