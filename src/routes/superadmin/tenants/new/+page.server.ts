import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Legacy alias for the onboarding wizard. */
export const load: PageServerLoad = async () => {
	throw redirect(308, '/superadmin/businesses/new');
};
