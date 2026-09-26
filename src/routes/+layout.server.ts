import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		hostKind: locals.hostKind,
		tenantSlug: locals.tenantSlug
	};
};
