import { redirect } from '@sveltejs/kit';

/** The canonical Customize hub is now /shop/customize. */
export function load() {
	throw redirect(302, '/shop/customize');
}
