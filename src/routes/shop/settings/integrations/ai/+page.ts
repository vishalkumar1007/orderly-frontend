import { redirect } from '@sveltejs/kit';

/** AI lives in the Integrations section. */
export function load() {
	throw redirect(302, '/shop/settings?section=integrations&service=AI');
}
