import { redirect } from '@sveltejs/kit';

/** Order workflow is a section of Settings. */
export function load() {
	throw redirect(302, '/shop/settings?section=workflow');
}
