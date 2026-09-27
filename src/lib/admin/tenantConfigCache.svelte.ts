import { fetchEffectiveConfig, fetchTenantConfig } from '$lib/admin/configApi';
import type { ConfigService, EffectiveConfig, TenantServiceDetail } from '$lib/admin/configTypes';

/**
 * In-memory cache for tenant configuration views.
 *
 * Each service (SMTP, Storage, AI) is a separate page in the tenant settings,
 * so navigating between them always triggers fresh API calls. This cache
 * stores the last-fetched detail + effective pair per service so that
 * navigating back to a previously-visited page is instant.
 */
interface TenantConfigEntry {
	detail: TenantServiceDetail;
	effective: EffectiveConfig;
}

const cache = $state<Record<string, TenantConfigEntry>>({});
const inflight = $state<Record<string, Promise<TenantConfigEntry>>>({});

export function getTenantConfig(service: ConfigService): TenantConfigEntry | null {
	return cache[service] ?? null;
}

/**
 * Load a tenant service config, using the cache when available.
 * Concurrent calls for the same service share one promise.
 */
export function loadTenantConfig(service: ConfigService): Promise<TenantConfigEntry> {
	if (service in cache) return Promise.resolve(cache[service]);
	if (service in inflight) return inflight[service];

	const p = Promise.all([fetchTenantConfig(service), fetchEffectiveConfig(service)])
		.then(([detail, effective]) => {
			const entry = { detail, effective };
			cache[service] = entry;
			return entry;
		})
		.catch((err) => {
			// Remove from inflight so a retry is possible.
			delete inflight[service];
			throw err;
		})
		.finally(() => {
			delete inflight[service];
		});

	inflight[service] = p;
	return p;
}

/**
 * Store a tenant config entry in the cache (call after save/test/delete).
 */
export function setTenantConfig(
	service: ConfigService,
	detail: TenantServiceDetail,
	effective: EffectiveConfig
): void {
	cache[service] = { detail, effective };
}

/**
 * Invalidate a single service (forces next access to re-fetch).
 */
export function invalidateTenantConfig(service: ConfigService): void {
	delete cache[service];
}
