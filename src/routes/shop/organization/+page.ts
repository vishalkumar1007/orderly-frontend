import { redirect } from '@sveltejs/kit';

/** Organization is no longer a hub; its screens moved. */
export function load() {
	throw redirect(302, '/shop/settings');
}
