import { redirect } from '@sveltejs/kit';
import { loadShopBrand } from '$lib/storefront/server';
import type { PageServerLoad } from './$types';

/**
 * Staff sign-in.
 *
 * Lives under /shop rather than at /login so that `/login` on a tenant host is
 * the *customer's* phone sign-in. Two audiences, two routes: a diner signing in
 * to reorder and an owner signing in to run the shop should never meet at the
 * same URL.
 *
 * Everything on this screen comes from the two public endpoints, and that is not
 * a convenience: it is forced. A sign-in page renders precisely when nobody is
 * signed in, so it has no token, so the authenticated tenant APIs are all 401.
 * A 404 on either read just means nothing is published yet and degrades to
 * null. Any other failure blocks the page with an error screen rather than a
 * sign-in in the wrong colours that then cannot sign anybody in anyway.
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (locals.hostKind !== 'tenant' || !locals.tenantSlug) {
		// The platform host has its own console entry point.
		if (locals.hostKind === 'unknown') {
			return { hostKind: locals.hostKind, tenantSlug: null, shop: null, brand: null, loadError: null };
		}
		throw redirect(302, '/superadmin/login');
	}

	const { shop, brand, loadError } = await loadShopBrand(locals);
	return { hostKind: locals.hostKind, tenantSlug: locals.tenantSlug, shop, brand, loadError };
};
