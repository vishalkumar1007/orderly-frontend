import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/**
 * The business console only exists on a business's own host.
 *
 * Reaching it on the platform host means somebody typed the wrong address, so
 * they are sent to the sign-in page — with one exception that is load-bearing:
 * the sign-in page is itself under `/shop`, so redirecting it here would make
 * this layout run again, redirect again, and loop until the browser gave up
 * with ERR_TOO_MANY_REDIRECTS and no explanation of what was wrong.
 *
 * `/shop/login` is therefore allowed through. Its own load knows what to do
 * with a non-tenant host: the platform host goes to the console sign-in, and an
 * unrecognised host renders a page saying so.
 */
export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (locals.hostKind !== 'tenant' && url.pathname !== '/shop/login') {
		throw redirect(302, '/shop/login');
	}
	return {
		hostKind: locals.hostKind,
		tenantSlug: locals.tenantSlug
	};
};
