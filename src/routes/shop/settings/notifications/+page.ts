import { redirect } from '@sveltejs/kit';
import { configHref } from '$lib/tenant/configuration';

/** Notifications is a section of Configuration. */
export function load() {
	throw redirect(302, configHref('notifications'));
}
