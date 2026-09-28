import { redirect } from '@sveltejs/kit';

/** Payments has its own destination in the rail. */
export function load() {
	throw redirect(302, '/shop/payments');
}
