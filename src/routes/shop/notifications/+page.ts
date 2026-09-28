import { redirect } from '@sveltejs/kit';

/** Legacy path. */
export function load() {
	throw redirect(302, '/shop/settings?section=notifications');
}
