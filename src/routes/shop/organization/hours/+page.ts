import { redirect } from '@sveltejs/kit';

/** Operating hours sit with the storefront. */
export function load() {
	throw redirect(302, '/shop/storefront/actions?section=hours');
}
