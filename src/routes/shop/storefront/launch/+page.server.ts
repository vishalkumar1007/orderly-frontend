import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Launch merged into Publish & Marketing.
 * Server load so the redirect works under the storefront layout's ssr=false.
 */
export const load: PageServerLoad = ({ url }) => {
	const tab = url.searchParams.get('tab') ?? '';

	if (tab === 'hours') {
		throw redirect(302, '/shop/storefront/actions?section=hours');
	}
	if (tab === 'broadcast') {
		throw redirect(302, '/shop/storefront/actions?section=banner');
	}
	if (tab === 'operations') {
		throw redirect(302, '/shop/storefront/actions?section=status');
	}
	if (tab === 'compliance') {
		throw redirect(302, '/shop/storefront/promote?tab=compliance');
	}
	if (tab === 'readiness' || tab === 'publish') {
		throw redirect(302, '/shop/storefront/promote?tab=publish');
	}
	if (tab === 'marketing') {
		const asset = url.searchParams.get('asset');
		const q = asset ? `?tab=marketing&asset=${encodeURIComponent(asset)}` : '?tab=marketing';
		throw redirect(302, `/shop/storefront/promote${q}`);
	}

	throw redirect(302, '/shop/storefront/promote');
};
