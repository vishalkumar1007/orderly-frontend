import { redirect } from '@sveltejs/kit';

/** Legacy path — integrations live under Settings → Integrations. */
export function load() {
	throw redirect(302, '/shop/settings/integrations/smtp');
}
