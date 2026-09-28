import { redirect } from '@sveltejs/kit';

/** Store information is the Business profile section of Settings. */
export function load() {
	throw redirect(302, '/shop/settings?section=business');
}
