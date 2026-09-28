import { redirect } from '@sveltejs/kit';

/** Business profile is a section of Settings. */
export function load() {
	throw redirect(302, '/shop/settings?section=business');
}
