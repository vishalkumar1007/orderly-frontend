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

export function tenantLoginUrl(slug: string, baseDomain = 'localhost', port = '5173'): string {
	return `http://${slug}.${baseDomain}:${port}/login`;
}

export function tenantStoreUrl(slug: string, baseDomain = 'localhost', port = '5173'): string {
	return `http://${slug}.${baseDomain}:${port}/`;
}
