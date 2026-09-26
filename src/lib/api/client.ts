import { env } from '$env/dynamic/public';
import { parseHost } from '$lib/host';

const BASE_DOMAIN = () => env.PUBLIC_BASE_DOMAIN || 'localhost';

/**
 * Server-side / production API origin (browser dev uses Vite proxy when not on a tenant host).
 */
function configuredApiOrigin(): string {
	const raw = env.PUBLIC_API_URL?.trim();
	if (raw) return raw;
	return 'http://127.0.0.1:8080';
}

/**
 * `tenantApiBase` rewrites the API origin so a request carries the tenant's
 * subdomain.
 *
 * This matters for server-side rendering. A load function calling
 * `http://127.0.0.1:8080/...` sends `Host: 127.0.0.1:8080`, which the API reads
 * as the platform host and cannot resolve to a tenant — so the storefront config
 * would come back empty and the first paint would be unthemed. Pointing at
 * `{slug}.{base}` keeps the tenant in the Host header, exactly as a browser
 * request does.
 */
export function tenantApiBase(slug: string): string {
	const base = BASE_DOMAIN();
	const origin = configuredApiOrigin();
	let protocol = 'http:';
	let port = '8080';
	try {
		const url = new URL(origin);
		protocol = url.protocol;
		port = url.port || (url.protocol === 'https:' ? '443' : '80');
	} catch {
		// An unparseable PUBLIC_API_URL is handled by the request itself failing
		// with a clear error; fall back to the plain http origin here.
	}
	const host = `${slug}.${base}`;
	return port && port !== '80' && port !== '443'
		? `${protocol}//${host}:${port}`
		: `${protocol}//${host}`;
}

/**
 * API origin for a request.
 *
 * In the browser, a tenant host is rewritten to the tenant's API subdomain so the
 * backend can resolve the shop. On the server the caller supplies the slug
 * explicitly via `ApiOptions.hostSlug`, because there is no `window` to read the
 * hostname from and a plain 127.0.0.1 request carries no tenant.
 */
export function apiBaseURL(hostSlug?: string | null): string {
	const configured = configuredApiOrigin();
	if (hostSlug) return tenantApiBase(hostSlug);

	if (typeof window === 'undefined') return configured;

	const info = parseHost(window.location.hostname, BASE_DOMAIN());
	if (info.kind === 'tenant' && info.slug) {
		try {
			const u = new URL(configured);
			const port = u.port || '8080';
			return `${u.protocol}//${info.slug}.${BASE_DOMAIN()}:${port}`;
		} catch {
			return `http://${info.slug}.${BASE_DOMAIN()}:8080`;
		}
	}
	// Super Admin + platform pages: avoid api.localhost DNS/CORS issues in local dev.
	if (import.meta.env.DEV) {
		return '';
	}
	return configured;
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
	 * The tenant slug to address the API with. Server-side callers pass this so
	 * the request carries the tenant in its Host header; browsers derive it from
	 * the current hostname instead.
	 */
	hostSlug?: string | null;
};

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
	const res = await fetch(`${apiBaseURL()}/api/v1/auth/refresh`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ refresh_token: refresh })
	});
	if (!res.ok) {
		clearTokens();
		return false;
	}
	const data = await res.json();
	setTokens(data.tokens);
	return true;
}

export async function api<T>(
	path: string,
	options: ApiOptions = {},
	auth = true
): Promise<T> {
	// `hostSlug` is a client-side option, not a fetch option, so it is stripped
	// before the request is built.
	const { authToken, hostSlug, ...init } = options;
	const base = apiBaseURL(hostSlug);
	const headers = new Headers(init.headers || {});
	if (!headers.has('Content-Type') && init.body) {
		headers.set('Content-Type', 'application/json');
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

	let res: Response;
	try {
		res = await fetch(`${base}${path}`, { ...init, headers });
	} catch (err) {
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

	// A refresh only makes sense for the stored staff session. A request that
	// carried an explicit token must never be retried with a different identity.
	const canRefresh = explicit === undefined && auth;
	if (res.status === 401 && canRefresh) {
		const ok = await refreshAccess();
		if (ok) {
			headers.set('Authorization', `Bearer ${getAccessToken()}`);
			try {
				res = await fetch(`${base}${path}`, { ...init, headers });
			} catch (err) {
				throw new ApiClientError(
					0,
					'network_error',
					err instanceof Error ? err.message : 'Network request failed'
				);
			}
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
