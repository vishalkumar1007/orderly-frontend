import { redirect } from '@sveltejs/kit';
import type { BrandTheme } from '$lib/brandTheme';
import type { StoreConfig } from '$lib/storefront/api';
import { serverApi } from '$lib/storefront/server';
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
 * a convenience — it is forced. A sign-in page renders precisely when nobody is
 * signed in, so it has no token, so the authenticated tenant APIs are all 401.
 * Both reads degrade to null rather than failing: a login page that shows the
 * wrong accent, or no logo, is still a login page, and one that errors instead
 * is the one screen that must never fail.
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (locals.hostKind !== 'tenant' || !locals.tenantSlug) {
		// The platform host has its own console entry point.
		if (locals.hostKind === 'unknown') {
			return { hostKind: locals.hostKind, tenantSlug: null, shop: null, brand: null };
		}
		throw redirect(302, '/superadmin/login');
	}

	const [storeResult, brandResult] = await Promise.allSettled([
		serverApi<StoreConfig>('/api/v1/public/store', locals),
		serverApi<BrandTheme>('/api/v1/public/theme', locals)
	]);

	let shop: { name: string; logoUrl: string } | null = null;
	if (storeResult.status === 'fulfilled') {
		const config = storeResult.value;
		if (config?.store) {
			shop = {
				// The slug is a better answer than an empty string, and a better
				// answer than the hostname a human typed.
				name: config.store.name?.trim() || locals.tenantSlug,
				logoUrl: config.store.logo_url?.trim() || ''
			};
		}
	}

	const brand =
		brandResult.status === 'fulfilled' && brandResult.value?.tokens ? brandResult.value : null;

	return { hostKind: locals.hostKind, tenantSlug: locals.tenantSlug, shop, brand };
};
