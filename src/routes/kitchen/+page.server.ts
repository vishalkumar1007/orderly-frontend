import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Legacy /kitchen URL — kitchen now lives under the org AppShell. */
export const load: PageServerLoad = async () => {
	throw redirect(302, '/shop/kitchen');
};
