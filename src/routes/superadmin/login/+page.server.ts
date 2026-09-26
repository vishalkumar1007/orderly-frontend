import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Dedicated Super Admin login route (also available at / on localhost). */
export const load: PageServerLoad = async ({ locals }) => {
	if (locals.hostKind === 'tenant') {
		throw redirect(302, '/shop/login');
	}
	return {};
};
