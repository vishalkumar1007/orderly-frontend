import { redirect } from '@sveltejs/kit';

/** Legacy Launch tabs → Action. Everything else → promote (see +page.server.ts). */
export function load() {
	/* Client fallback only; server redirect is authoritative. */
}
