import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Per-business provider access is a configuration decision, not a credential. */
export const load: PageServerLoad = async () => {
	throw redirect(308, '/superadmin/settings?section=tenant-access');
};
