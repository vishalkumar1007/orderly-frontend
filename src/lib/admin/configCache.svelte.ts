import { fetchPlatformConfig } from '$lib/admin/configApi';
import type { ConfigService, ConfigView } from '$lib/admin/configTypes';

/**
 * In-memory cache for platform configuration views.
 *
 * Without this, every tab switch in the settings page destroys and
 * re-creates the provider panel, triggering a fresh API call and
 * skeleton flash each time. The cache lets us pre-fetch all three
 * services in parallel and serve them instantly on tab switches.
 */
const cache = $state<Record<string, ConfigView | null>>({});
const inflight = $state<Record<string, Promise<ConfigView | null>>>({});

export function getConfig(service: ConfigService): ConfigView | null {
	return cache[service] ?? null;
}

export function isConfigCached(service: ConfigService): boolean {
	return service in cache;
}

/**
 * Fetch a single service config, using the cache when available.
 * Concurrent calls for the same service share one promise.
 *
 * This rejects when the request fails, and that matters more than it looks:
 * `null` is a legitimate answer meaning "this service has no configuration
 * yet". Turning a failed request into `null` made an unreachable API render as
 * an empty setup form, so the operator saw "not configured" for something that
 * was configured and working. Failures are not cached either, so the next
 * visit retries.
 */
export function loadConfig(service: ConfigService): Promise<ConfigView | null> {
	if (service in cache) return Promise.resolve(cache[service]);
	if (service in inflight) return inflight[service];

	const p = fetchPlatformConfig(service)
		.then((view) => {
			cache[service] = view;
			return view;
		})
		.finally(() => {
			delete inflight[service];
		});

	inflight[service] = p;
	return p;
}

/**
 * Pre-fetch all three service configs in parallel.
 * Safe to call multiple times — already-cached services are skipped.
 *
 * A prefetch failing is not an error anybody should be told about: nothing is
 * on screen yet. The screen that actually opens the service calls
 * `loadConfig` again and reports the failure there, with somewhere to put it.
 */
export function preloadAllConfigs(): Promise<void> {
	const services: ConfigService[] = ['SMTP', 'STORAGE', 'AI'];
	return Promise.all(services.map((s) => loadConfig(s).catch(() => null))).then(() => {});
}

/**
 * Store a config view in the cache (call after save/test so the cache stays fresh).
 */
export function setConfig(service: ConfigService, view: ConfigView | null): void {
	cache[service] = view;
}

/**
 * Invalidate a single service (forces next access to re-fetch).
 */
export function invalidateConfig(service: ConfigService): void {
	delete cache[service];
}

/**
 * Invalidate all configs (call after a bulk operation).
 */
export function invalidateAllConfigs(): void {
	for (const k of Object.keys(cache)) delete cache[k];
}
