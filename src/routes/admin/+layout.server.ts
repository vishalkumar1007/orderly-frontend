import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/** Any leftover /admin/* path → /superadmin/* */
export const load: LayoutServerLoad = async ({ url }) => {
	const rest = url.pathname.replace(/^\/admin/, '') || '';
	throw redirect(302, `/superadmin${rest}${url.search}`);
};
