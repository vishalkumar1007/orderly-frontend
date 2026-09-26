import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (locals.hostKind !== 'tenant') {
		throw redirect(302, '/shop/login');
	}
	return {
		hostKind: locals.hostKind,
		tenantSlug: locals.tenantSlug
	};
};
