import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** QR & Share lives in Marketing, Share kit. */
export const load: PageServerLoad = () => {
	throw redirect(302, '/shop/marketing/kit?asset=qr');
};
