import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Per-business provider access is part of Providers & integrations. */
export const load: PageServerLoad = async () => {
	throw redirect(308, '/superadmin/providers?tab=access');
};
