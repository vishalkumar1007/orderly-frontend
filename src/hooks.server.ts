import { redirect, type Handle, type HandleServerError } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import { parseHost } from '$lib/host';

/** Legacy Launch / QR / preview paths → Publish & Marketing (or Action). */
function legacyStorefrontRedirect(pathname: string, searchParams: URLSearchParams): string | null {
	const path = pathname.replace(/\/+$/, '') || '/';

	if (path === '/shop/storefront/qr') {
		return '/shop/storefront/promote?tab=marketing&asset=qr';
	}
	if (path === '/shop/storefront/preview') {
		return '/shop/storefront/promote';
	}
	if (path === '/shop/storefront/launch') {
		const tab = searchParams.get('tab') ?? '';
		if (tab === 'hours') return '/shop/storefront/actions?section=hours';
		if (tab === 'broadcast') return '/shop/storefront/actions?section=banner';
		if (tab === 'operations') return '/shop/storefront/actions?section=status';
		if (tab === 'compliance') return '/shop/storefront/promote?tab=compliance';
		if (tab === 'readiness' || tab === 'publish') return '/shop/storefront/promote?tab=publish';
		if (tab === 'marketing') {
			const asset = searchParams.get('asset');
			return asset
				? `/shop/storefront/promote?tab=marketing&asset=${encodeURIComponent(asset)}`
				: '/shop/storefront/promote?tab=marketing';
		}
		return '/shop/storefront/promote';
	}
	return null;
}

export const handle: Handle = async ({ event, resolve }) => {
	const base = env.PUBLIC_BASE_DOMAIN || 'localhost';
	const info = parseHost(event.url.hostname, base);
	event.locals.hostKind = info.kind;
	event.locals.tenantSlug = info.slug;

	const to = legacyStorefrontRedirect(event.url.pathname, event.url.searchParams);
	if (to) throw redirect(302, to);

	return resolve(event);
};

export const handleError: HandleServerError = ({ message }) => {
	return { message: message || 'Internal Error' };
};
