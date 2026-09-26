import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Staff sign-in.
 *
 * Lives under /shop rather than at /login so that `/login` on a tenant host is
 * the *customer's* phone sign-in. Two audiences, two routes: a diner signing in
 * to reorder and an owner signing in to run the shop should never meet at the
 * same URL.
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (locals.hostKind !== 'tenant' || !locals.tenantSlug) {
		// The platform host has its own console entry point.
		if (locals.hostKind === 'unknown') {
			return { hostKind: locals.hostKind, tenantSlug: null };
		}
		throw redirect(302, '/superadmin/login');
	}
	return { hostKind: locals.hostKind, tenantSlug: locals.tenantSlug };
};
