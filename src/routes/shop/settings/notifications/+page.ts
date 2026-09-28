import { redirect } from '@sveltejs/kit';

/** Notifications is a section of Settings. */
export function load() {
	throw redirect(302, '/shop/settings?section=notifications');
}
