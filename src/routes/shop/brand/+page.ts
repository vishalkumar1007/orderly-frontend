import { redirect } from '@sveltejs/kit';

/** Console appearance is a section of Settings. */
export function load() {
	throw redirect(302, '/shop/settings?section=appearance');
}
