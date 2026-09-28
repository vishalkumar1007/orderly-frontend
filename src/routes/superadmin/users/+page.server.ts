import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Platform user management now lives under Users & IAM. */
export const load: PageServerLoad = async () => {
	throw redirect(308, '/superadmin/iam');
};
