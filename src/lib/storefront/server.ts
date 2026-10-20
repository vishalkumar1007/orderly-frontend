/**
 * Server-side data access for the storefront.
 *
 * Public storefront endpoints resolve the tenant from the request hostname, so a
 * server-rendered load has to address the API with the tenant's subdomain in the
 * Host header. `serverApi` does that; without it every load would hit the
 * platform host and get nothing back.
 *
 * Nothing here reads a tenant id from a URL, a query string or a header the
 * client controls: the slug comes from `locals`, which the host hook derived
 * from the request hostname.
 */

import { api, ApiClientError, type ApiOptions } from '$lib/api/client';
import type { BrandTheme } from '$lib/brandTheme';
import type { StoreConfig } from '$lib/storefront/api';

export type StorefrontLocals = { hostKind: 'admin' | 'tenant' | 'unknown'; tenantSlug: string | null };

/** `serverApi` issues a public storefront call addressed at the request's tenant. */
export function serverApi<T>(path: string, locals: StorefrontLocals, options: ApiOptions = {}): Promise<T> {
	return api<T>(path, { ...options, hostSlug: locals.tenantSlug, authToken: null });
}

export type LoadError = { code: string; status: number; message: string };

/** A failure worth blocking on: anything but a 404, which just means "nothing published". */
function blockingError(result: PromiseSettledResult<unknown>): LoadError | null {
	if (result.status === 'fulfilled') return null;
	const err = result.reason;
	if (err instanceof ApiClientError) {
		return err.status === 404 ? null : { code: err.code, status: err.status, message: err.message };
	}
	return { code: 'network_error', status: 0, message: err instanceof Error ? err.message : String(err) };
}

/**
 * The shop's name, logo and console brand for the signed-out screens (staff
 * sign-in, invite password setup), read on the server so the first frame is
 * already the shop's colours. A real failure is returned as `loadError` so
 * the page blocks instead of painting the built-in theme.
 */
export async function loadShopBrand(locals: StorefrontLocals) {
	const [storeResult, brandResult] = await Promise.allSettled([
		serverApi<StoreConfig>('/api/v1/public/store', locals),
		serverApi<BrandTheme>('/api/v1/public/theme', locals)
	]);

	let shop: { name: string; logoUrl: string } | null = null;
	if (storeResult.status === 'fulfilled' && storeResult.value?.store) {
		const store = storeResult.value.store;
		shop = {
			// The slug is a better answer than an empty string, and a better
			// answer than the hostname a human typed.
			name: store.name?.trim() || locals.tenantSlug || '',
			logoUrl: store.logo_url?.trim() || ''
		};
	}
	const brand =
		brandResult.status === 'fulfilled' && brandResult.value?.tokens ? brandResult.value : null;

	return { shop, brand, loadError: blockingError(storeResult) ?? blockingError(brandResult) };
}
