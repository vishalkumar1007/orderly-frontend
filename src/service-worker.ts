/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

/**
 * Orderly Shop Admin service worker.
 *
 * Caching policy is deliberately conservative. Auth and shop data are NEVER
 * cached:
 *  - `/api/**` is network-only, so a stale order can never be shown as live and
 *    one signed-in operator can never read another's data off a shared device.
 *  - Non-GET requests bypass the cache entirely.
 * Only the immutable app shell (hashed build assets + static files) is
 * precached, which is what makes the app open instantly and work offline for
 * navigation.
 */

const SHELL_CACHE = `orderly-shell-${version}`;
const RUNTIME_CACHE = `orderly-runtime-${version}`;
const OFFLINE_URL = '/offline.html';

const PRECACHE = [...build, ...files];

/** Hashed build output and versioned static assets can be trusted forever. */
function isImmutable(url: URL): boolean {
	return url.pathname.startsWith('/_app/immutable/') || url.pathname.startsWith('/icons/');
}

/** Never store anything under these — they are per-user or transactional. */
function isPrivate(url: URL): boolean {
	return (
		url.pathname.startsWith('/api/') ||
		url.pathname.startsWith('/auth/') ||
		url.pathname.startsWith('/login') ||
		url.pathname.startsWith('/setup-password')
	);
}

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(SHELL_CACHE);
			// addAll is atomic — one 404 and nothing is cached — so add
			// individually and tolerate misses on optional assets.
			await Promise.all(
				PRECACHE.map(async (asset) => {
					try {
						await cache.add(asset);
					} catch {
						/* an asset we cannot precache is not fatal */
					}
				})
			);
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			// Drop caches from previous versions.
			const keys = await caches.keys();
			await Promise.all(
				keys
					.filter((k) => k.startsWith('orderly-') && k !== SHELL_CACHE && k !== RUNTIME_CACHE)
					.map((k) => caches.delete(k))
			);
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('message', (event) => {
	// The page asks us to activate a waiting worker after the user accepts an update.
	if (event.data === 'SKIP_WAITING') sw.skipWaiting();
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;

	// Range requests (media) and non-GET verbs are passed straight through.
	if (request.method !== 'GET') return;

	const url = new URL(request.url);

	// Only handle same-origin traffic; the tenant API is cross-origin in dev.
	if (url.origin !== sw.location.origin) return;

	// Never cache auth or shop data.
	if (isPrivate(url)) return;

	// Hashed assets: cache-first, and fill the cache on first fetch.
	if (isImmutable(url)) {
		event.respondWith(
			(async () => {
				const cache = await caches.open(SHELL_CACHE);
				const hit = await cache.match(request);
				if (hit) return hit;
				const res = await fetch(request);
				if (res.ok) cache.put(request, res.clone());
				return res;
			})()
		);
		return;
	}

	// Everything else is same-origin navigation/document traffic: network-first
	// so users always get the freshest app, with the cached shell as fallback.
	if (request.mode === 'navigate' || request.destination === 'document') {
		event.respondWith(
			(async () => {
				try {
					const res = await fetch(request);
					if (res.ok) {
						const cache = await caches.open(RUNTIME_CACHE);
						cache.put(request, res.clone());
					}
					return res;
				} catch {
					// Offline: prefer the cached page, then the offline page.
					const cached = await caches.match(request);
					if (cached) return cached;
					const offline = await caches.match(OFFLINE_URL);
					if (offline) return offline;
					return new Response('Offline', {
						status: 503,
						headers: { 'Content-Type': 'text/plain' }
					});
				}
			})()
		);
		return;
	}

	// Remaining static GETs (favicon, manifest, fonts): stale-while-revalidate.
	event.respondWith(
		(async () => {
			const cache = await caches.open(RUNTIME_CACHE);
			const hit = await cache.match(request);
			const network = fetch(request)
				.then((res) => {
					if (res.ok) cache.put(request, res.clone());
					return res;
				})
				.catch(() => hit);
			return hit || network;
		})()
	);
});
