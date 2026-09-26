import type { StoreMenu } from '$lib/storefront/api';
import { serverApi } from '$lib/storefront/server';
import type { PageServerLoad } from './$types';

/**
 * The home page needs the menu on top of the shell's config, because the
 * homepage sections are menu-driven: categories, popular and featured products
 * all come out of the same payload the menu page uses. One request for both
 * keeps the first meaningful paint to a single round trip.
 */
export const load: PageServerLoad = async ({ parent, locals }) => {
	const shell = await parent();
	if (!shell.tenantSlug) return { menu: null as StoreMenu | null, menuError: '' };

	try {
		const menu = await serverApi<StoreMenu>('/api/v1/public/menu', locals);
		return { menu, menuError: '' };
	} catch (err) {
		// An unpublished or unreachable store gets a readable message rather than a
		// stack trace; the shell still renders its header and footer.
		return {
			menu: null,
			menuError: err instanceof Error ? err.message : 'Menu unavailable'
		};
	}
};
