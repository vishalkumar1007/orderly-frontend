import { redirect } from '@sveltejs/kit';

/** Storage lives in the Integrations section. */
export function load() {
	throw redirect(302, '/shop/settings?section=integrations&service=STORAGE');
}
