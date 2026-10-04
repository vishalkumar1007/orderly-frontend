import { env } from '$env/dynamic/public';
import { parseHost } from '$lib/host';

const BASE_DOMAIN = () => env.PUBLIC_BASE_DOMAIN || 'localhost';

/** Header that identifies the shop tenant when dialing the shared API host. */
export const TENANT_SLUG_HEADER = 'X-Tenant-Slug';

/**
 * Configured API origin from PUBLIC_API_URL.
 * Production: https://api.orderly.qd.je
 * Local: http://api.localhost:8080 (or empty → Vite /api proxy in the browser)
 * SSR internal: http://fs-A1-d3e4-k9:8080 (Host overridden via X-Forwarded-Host)
 */
function configuredApiOrigin(): string {
	const raw = env.PUBLIC_API_URL?.trim();
	if (raw) return raw;
	return 'http://127.0.0.1:8080';
}

function originParts(): { scheme: string; port: string; hostname: string; configured: string } {
	const configured = configuredApiOrigin();
	try {
		const u = new URL(configured);
		return {
			scheme: u.protocol,
			port: u.port,
			hostname: u.hostname.toLowerCase(),
			configured
		};
	} catch {
		return { scheme: 'http:', port: '8080', hostname: '127.0.0.1', configured };
	}
}

/** True when PUBLIC_API_URL is a public api.{base} style host (not a Docker service name). */
function isPublicAPIHost(hostname: string, base: string): boolean {
	const h = hostname.toLowerCase();
	const b = base.toLowerCase();
	return h === `api.${b}` || h === 'api.localhost';
}

function buildOrigin(hostname: string, scheme: string, port: string): string {
	if (port && port !== '80' && port !== '443') {
		return `${scheme}//${hostname}:${port}`;
	}
	return `${scheme}//${hostname}`;
}

/**
 * Platform API host value used for X-Forwarded-Host when SSR dials an internal upstream.
 */
export function platformForwardedHost(): string {
	return `api.${BASE_DOMAIN()}`;
}

/**
 * Absolute shared API origin: https://api.{base} (or local :8080 variant).
 * Shop and platform pages both dial this host; tenant identity is sent via
 * X-Tenant-Slug, never via `{slug}.api.{base}` hostnames.
 */
export function platformApiOrigin(): string {
	const base = BASE_DOMAIN();
	const { scheme, port, hostname, configured } = originParts();
	if (isPublicAPIHost(hostname, base)) {
		return buildOrigin(`api.${base}`, scheme, port);
	}
	// Internal Docker upstream — keep as configured; caller sets X-Forwarded-Host.
	if (hostname !== '127.0.0.1' && hostname !== 'localhost') {
		return configured;
	}
	return buildOrigin(`api.${base}`, scheme, port || '8080');
}

/**
 * Resolve the tenant slug for an API call from an explicit option or the
 * browser hostname. Returns null on platform/admin pages.
 */
export function resolveTenantSlug(hostSlug?: string | null): string | null {
	if (hostSlug) return hostSlug;
	if (typeof window === 'undefined') return null;
	const info = parseHost(window.location.hostname, BASE_DOMAIN());
	return info.kind === 'tenant' ? info.slug : null;
}

/**
 * API origin for a request.
 *
 * Always the shared platform API host. Local browser with empty PUBLIC_API_URL
 * uses '' so Vite proxies /api with the page Host (legacy {slug}.localhost).
 */
export function apiBaseURL(_hostSlug?: string | null): string {
	const configuredRaw = env.PUBLIC_API_URL?.trim();

	// Dev convenience: unset PUBLIC_API_URL → same-origin Vite proxy.
	if (typeof window !== 'undefined' && import.meta.env.DEV && !configuredRaw) {
		return '';
	}

	return platformApiOrigin();
}

export type ApiError = { error: { code: string; message: string } };

/**
 * `ApiOptions` extends `RequestInit` with an explicit credential.
 *
 * `authToken: null` sends no Authorization header; a string sends that bearer
 * token. Omitting it keeps the existing behaviour of using the stored staff
 * session, so no existing call site changes.
 */
export type ApiOptions = RequestInit & {
	authToken?: string | null;
	/**
	 * The tenant slug to address the API with. Sent as X-Tenant-Slug.
	 * Server-side callers pass this; browsers derive it from the current hostname.
	 */
	hostSlug?: string | null;
	/**
	 * Abort the request after this many milliseconds. Defaults to 8000 in the
	 * browser so hung APIs never leave the UI on an infinite skeleton. Pass 0
	 * to disable. Server loads inherit AbortSignal when provided via `signal`.
	 */
	timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 8_000;

function mergeAbortSignal(
	userSignal: AbortSignal | null | undefined,
	timeoutMs: number
): { signal: AbortSignal | undefined; cancelTimer: () => void } {
	if (timeoutMs <= 0 && !userSignal) {
		return { signal: undefined, cancelTimer: () => {} };
	}
	if (timeoutMs <= 0) {
		return { signal: userSignal ?? undefined, cancelTimer: () => {} };
	}

	const controller = new AbortController();
	const timer = setTimeout(() => {
		controller.abort(new DOMException('Request timed out', 'TimeoutError'));
	}, timeoutMs);

	const cancelTimer = () => clearTimeout(timer);

	if (userSignal) {
		if (userSignal.aborted) {
			cancelTimer();
			controller.abort(userSignal.reason);
		} else {
			userSignal.addEventListener(
				'abort',
				() => {
					cancelTimer();
					controller.abort(userSignal.reason);
				},
				{ once: true }
			);
		}
	}

	return { signal: controller.signal, cancelTimer };
}

export class ApiClientError extends Error {
	code: string;
	status: number;
	constructor(status: number, code: string, message: string) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

type Tokens = {
	access_token: string;
	refresh_token: string;
	token_type: string;
	expires_in: number;
};

const ACCESS_KEY = 'orderly_access';
const REFRESH_KEY = 'orderly_refresh';

export function getAccessToken(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(tokens: Tokens) {
	localStorage.setItem(ACCESS_KEY, tokens.access_token);
	localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
}

export function clearTokens() {
	localStorage.removeItem(ACCESS_KEY);
	localStorage.removeItem(REFRESH_KEY);
}

async function refreshAccess(): Promise<boolean> {
	const refresh = getRefreshToken();
	if (!refresh) return false;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 5_000);
	try {
		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		const slug = resolveTenantSlug();
		if (slug) headers[TENANT_SLUG_HEADER] = slug;
		const res = await fetch(`${apiBaseURL()}/api/v1/auth/refresh`, {
			method: 'POST',
			headers,
			body: JSON.stringify({ refresh_token: refresh }),
			signal: controller.signal
		});
		if (!res.ok) {
			clearTokens();
			return false;
		}
		const data = await res.json();
		setTokens(data.tokens);
		return true;
	} catch {
		return false;
	} finally {
		clearTimeout(timer);
	}
}

export async function api<T>(
	path: string,
	options: ApiOptions = {},
	auth = true
): Promise<T> {
	// `hostSlug` / `timeoutMs` are client-side options, not fetch options.
	const { authToken, hostSlug, timeoutMs, ...init } = options;
	const base = apiBaseURL(hostSlug);
	const headers = new Headers(init.headers || {});
	// FormData must keep the browser-generated multipart boundary; forcing
	// application/json breaks image uploads.
	if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
		headers.set('Content-Type', 'application/json');
	}

	const slug = resolveTenantSlug(hostSlug);
	if (slug && !headers.has(TENANT_SLUG_HEADER)) {
		headers.set(TENANT_SLUG_HEADER, slug);
	}

	// SSR cannot always set Host via fetch(). When dialing an internal Docker
	// upstream, advertise the shared public API host so middleware treats the
	// request as HostAPI; tenant identity comes from X-Tenant-Slug.
	if (typeof window === 'undefined' && !headers.has('X-Forwarded-Host')) {
		const fwd = platformForwardedHost();
		try {
			const u = new URL(base || configuredApiOrigin());
			if (u.hostname.toLowerCase() !== fwd.toLowerCase()) {
				headers.set('X-Forwarded-Host', fwd);
			}
		} catch {
			headers.set('X-Forwarded-Host', fwd);
		}
	}
	// A caller may pass an explicit credential for one request. The storefront
	// needs this: a diner's session token is not the staff token in
	// localStorage, and mixing the two would be a privilege bug. `null` means
	// "send no credential", which is what a guest storefront call does.
	const explicit = authToken;
	void authToken;
	if (explicit !== undefined) {
		if (explicit === null) headers.delete('Authorization');
		else headers.set('Authorization', `Bearer ${explicit}`);
	} else if (auth) {
		const token = getAccessToken();
		if (token) headers.set('Authorization', `Bearer ${token}`);
	}

	const effectiveTimeout =
		timeoutMs !== undefined
			? timeoutMs
			: typeof window !== 'undefined'
				? DEFAULT_TIMEOUT_MS
				: 0;
	const { signal, cancelTimer } = mergeAbortSignal(init.signal, effectiveTimeout);

	let res: Response;
	try {
		res = await fetch(`${base}${path}`, { ...init, headers, signal });
	} catch (err) {
		cancelTimer();
		const aborted =
			(err instanceof DOMException && err.name === 'TimeoutError') ||
			(err instanceof Error && err.name === 'AbortError');
		if (aborted) {
			throw new ApiClientError(
				0,
				'timeout',
				'This request took too long. Check that the API is running and try again.'
			);
		}
		const hint =
			import.meta.env.DEV && !base
				? ' Start the API from orderly-backend: make run'
				: ' Check PUBLIC_API_URL and that the API is running.';
		throw new ApiClientError(
			0,
			'network_error',
			`${err instanceof Error ? err.message : 'Network request failed'}.${hint}`
		);
	}
	cancelTimer();

	// A refresh only makes sense for the stored staff session. A request that
	// carried an explicit token must never be retried with a different identity.
	const canRefresh = explicit === undefined && auth;
	if (res.status === 401 && canRefresh) {
		const ok = await refreshAccess();
		if (ok) {
			headers.set('Authorization', `Bearer ${getAccessToken()}`);
			const retry = mergeAbortSignal(undefined, effectiveTimeout);
			try {
				res = await fetch(`${base}${path}`, { ...init, headers, signal: retry.signal });
			} catch (err) {
				retry.cancelTimer();
				const aborted =
					(err instanceof DOMException && err.name === 'TimeoutError') ||
					(err instanceof Error && err.name === 'AbortError');
				if (aborted) {
					throw new ApiClientError(
						0,
						'timeout',
						'This request took too long. Check that the API is running and try again.'
					);
				}
				throw new ApiClientError(
					0,
					'network_error',
					err instanceof Error ? err.message : 'Network request failed'
				);
			}
			retry.cancelTimer();
		}
	}

	if (!res.ok) {
		let code = 'error';
		let message = res.statusText;
		try {
			const body = (await res.json()) as ApiError;
			code = body.error?.code || code;
			message = body.error?.message || message;
		} catch {
			/* ignore */
		}
		throw new ApiClientError(res.status, code, message);
	}

	if (res.status === 204) return undefined as T;
	return (await res.json()) as T;
}
