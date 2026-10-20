import { redirect } from '@sveltejs/kit';
import { configHref } from '$lib/tenant/configuration';

/** Integrations is a section of Configuration. */
export function load() {
	throw redirect(302, configHref('integrations', 'service=AI'));
}
