import { redirect } from '@sveltejs/kit';
import { ApiClientError } from '$lib/api/client';
import type { StoreConfig } from '$lib/storefront/api';
import { serverApi } from '$lib/storefront/server';
import type { LayoutServerLoad } from './$types';

/**
 * The storefront shell load.
 *
 * The tenant is resolved from the hostname, never from a parameter: a storefront
 * URL is the tenant's own subdomain. The slug is forwarded to the API so the
 * server-rendered request carries the tenant in its Host header: without it the
 * API would see the platform host and return nothing.
 *
 * The store config is fetched here rather than in each page so the theme is
 * present in the server-rendered HTML: the first frame is already the tenant's
 * colours, with no flash of a default: and so moving between storefront pages
 * does not re-fetch it.
 *
 * A failure here blocks the page with an error screen: a storefront in the
 * default theme with a placeholder name looks like a different shop, so it is
 * never rendered as if it worked. Unpublished shops (404 not_found) stay on
 * the unpublished screen: that is intentional.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	if (locals.hostKind !== 'tenant' || !locals.tenantSlug) {
		// The platform host has no storefront. The root path resolves here too, and
		// the layout renders the Super Admin entry point for it, so the platform
		// root keeps behaving exactly as it did before the storefront existed.
		if (locals.hostKind === 'unknown') {
			return {
				hostKind: locals.hostKind,
				tenantSlug: null,
				config: null,
				configError: '',
				configErrorCode: '',
				configErrorStatus: 0
			};
		}
		throw redirect(302, '/shop/login');
	}

	try {
		const config = await serverApi<StoreConfig>('/api/v1/public/store', locals);
		return {
			hostKind: locals.hostKind,
			tenantSlug: locals.tenantSlug,
			config,
			configError: '',
			configErrorCode: '',
			configErrorStatus: 0
		};
	} catch (error) {
		const message =
			error instanceof Error && error.message ? error.message : 'Store unavailable';
		const code =
			error instanceof ApiClientError
				? error.code || (error.status === 404 ? 'not_found' : 'error')
				: 'network_error';
		return {
			hostKind: locals.hostKind,
			tenantSlug: locals.tenantSlug,
			config: null,
			configError: message,
			configErrorCode: code,
			configErrorStatus: error instanceof ApiClientError ? error.status : 0
		};
	}
};
