import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/** Super Admin portal — separate from tenant /shop. Block tenant hosts. */
export const load: LayoutServerLoad = async ({ locals }) => {
	if (locals.hostKind === 'tenant') {
		throw redirect(302, '/');
	}
	return {
		hostKind: locals.hostKind,
		tenantSlug: locals.tenantSlug
	};
};
