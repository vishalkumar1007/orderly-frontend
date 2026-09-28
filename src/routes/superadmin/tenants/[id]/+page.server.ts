import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Legacy alias for one business, keeping the tab the link pointed at. */
export const load: PageServerLoad = async ({ params, url }) => {
	throw redirect(308, `/superadmin/businesses/${params.id}${url.search}`);
};
