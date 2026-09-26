/**
 * Server-side data access for the storefront.
 *
 * Public storefront endpoints resolve the tenant from the request hostname, so a
 * server-rendered load has to address the API with the tenant's subdomain in the
 * Host header. `serverApi` does that; without it every load would hit the
 * platform host and get nothing back.
 *
 * Nothing here reads a tenant id from a URL, a query string or a header the
 * client controls — the slug comes from `locals`, which the host hook derived
 * from the request hostname.
 */

import { api, type ApiOptions } from '$lib/api/client';

export type StorefrontLocals = { hostKind: 'admin' | 'tenant' | 'unknown'; tenantSlug: string | null };

/** `serverApi` issues a public storefront call addressed at the request's tenant. */
export function serverApi<T>(path: string, locals: StorefrontLocals, options: ApiOptions = {}): Promise<T> {
	return api<T>(path, { ...options, hostSlug: locals.tenantSlug, authToken: null });
}
