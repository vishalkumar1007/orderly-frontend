import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * `/superadmin/tenants` was the old address for the business list. The console
 * says "business" everywhere now, so the URL does too — this keeps every
 * bookmark, email link and copied URL working.
 */
export const load: PageServerLoad = async () => {
	throw redirect(308, '/superadmin/businesses');
};
