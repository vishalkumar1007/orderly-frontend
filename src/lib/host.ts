export type HostKind = 'admin' | 'tenant' | 'unknown';

export type HostInfo = {
	kind: HostKind;
	slug: string | null;
	hostname: string;
};

/** Parse hostname → admin | tenant | unknown (+ slug for tenant). */
export function parseHost(hostname: string, baseDomain = 'localhost'): HostInfo {
	const host = hostname.split(':')[0].toLowerCase().trim();
	const base = baseDomain.toLowerCase().trim() || 'localhost';

	if (host === `admin.${base}` || host === 'admin') {
		return { kind: 'admin', slug: null, hostname: host };
	}

	const suffix = `.${base}`;
	if (host === base || host === `api.${base}` || host === 'api' || host === 'www' || host === `www.${base}`) {
		return { kind: 'unknown', slug: null, hostname: host };
	}

	if (host.endsWith(suffix)) {
		const sub = host.slice(0, -suffix.length);
		if (!sub || sub === 'www' || sub === 'api') {
			return { kind: 'unknown', slug: null, hostname: host };
		}
		if (sub === 'admin') {
			return { kind: 'admin', slug: null, hostname: host };
		}
		return { kind: 'tenant', slug: sub, hostname: host };
	}

	return { kind: 'unknown', slug: null, hostname: host };
}

/** True when browser links should use http + optional Vite port. */
export function isLocalBaseDomain(baseDomain: string): boolean {
	const b = baseDomain.toLowerCase().trim();
	return b === 'localhost' || b === '127.0.0.1';
}

/**
 * Absolute browser origin for a tenant storefront / shop console.
 * Never uses `{slug}.api.{base}` — that is the API host only.
 */
export function tenantFrontendOrigin(
	slug: string,
	baseDomain = 'localhost',
	port?: string | null
): string {
	const base = (baseDomain || 'localhost').toLowerCase().trim();
	const local = isLocalBaseDomain(base);
	const scheme = local ? 'http' : 'https';
	const p = (port ?? '').trim();
	const withPort = local && p && p !== '80' && p !== '443' ? `:${p}` : '';
	return `${scheme}://${slug}.${base}${withPort}`;
}

export function tenantLoginUrl(slug: string, baseDomain = 'localhost', port?: string | null): string {
	return `${tenantFrontendOrigin(slug, baseDomain, port)}/login`;
}

export function tenantStoreUrl(slug: string, baseDomain = 'localhost', port?: string | null): string {
	return `${tenantFrontendOrigin(slug, baseDomain, port)}/`;
}
