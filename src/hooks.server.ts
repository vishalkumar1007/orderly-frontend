import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import { parseHost } from '$lib/host';

export const handle: Handle = async ({ event, resolve }) => {
	const base = env.PUBLIC_BASE_DOMAIN || 'localhost';
	const info = parseHost(event.url.hostname, base);
	event.locals.hostKind = info.kind;
	event.locals.tenantSlug = info.slug;
	return resolve(event);
};
