import { error } from '@sveltejs/kit';
import type { StoreService, StoreStaff } from '$lib/storefront/api';
import { serverApi } from '$lib/storefront/server';
import type { PageServerLoad } from './$types';

/** The service being booked and who can take it, loaded for the first paint. */
export const load: PageServerLoad = async ({ params, parent, locals }) => {
	const shell = await parent();
	if (!shell.tenantSlug) throw error(404, 'Not found');
	let res: { services: StoreService[]; staff: StoreStaff[] };
	try {
		res = await serverApi('/api/v1/public/services', locals);
	} catch {
		throw error(404, 'Online booking is not available here');
	}
	const service = res.services.find((s) => s.id === params.serviceId);
	if (!service) throw error(404, 'That service is no longer offered');
	return { service, staff: res.staff };
};
