import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** QR & Share merged into Publish & Marketing → Marketing tab. */
export const load: PageServerLoad = () => {
	throw redirect(302, '/shop/storefront/promote?tab=marketing&asset=qr');
};
