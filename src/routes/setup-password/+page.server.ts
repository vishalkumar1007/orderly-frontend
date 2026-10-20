import { loadShopBrand } from '$lib/storefront/server';
import type { PageServerLoad } from './$types';

/**
 * The invite's first screen, branded on the server like the staff sign-in so
 * the owner never sees the built-in theme flash before their own.
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (locals.hostKind !== 'tenant' || !locals.tenantSlug) {
		return { shop: null, brand: null, loadError: null };
	}
	return loadShopBrand(locals);
};
