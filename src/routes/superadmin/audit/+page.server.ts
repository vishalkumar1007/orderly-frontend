import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Activity and the audit log are one screen with two tabs. They read the same
 * stream with different questions in mind, and splitting them made an operator
 * choose a destination before knowing which one held the answer.
 */
export const load: PageServerLoad = async () => {
	throw redirect(308, '/superadmin/activity?tab=audit');
};
