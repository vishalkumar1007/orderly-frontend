import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Provider credentials moved out of Settings. They are an operational surface
 * — status, connection tests, per-business access — so they live under
 * Providers & integrations with the rest of that machinery.
 */
export const load: PageServerLoad = async () => {
	throw redirect(308, '/superadmin/providers/storage');
};
