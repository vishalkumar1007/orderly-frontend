import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Legacy /admin → Super Admin dashboard (no shared UI with this path). */
export const load: PageServerLoad = async () => {
	throw redirect(302, '/superadmin');
};
