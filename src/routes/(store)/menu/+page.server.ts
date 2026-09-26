import type { StoreMenu } from '$lib/storefront/api';
import { serverApi } from '$lib/storefront/server';
import type { PageServerLoad } from './$types';

/** The full menu page reuses the home page's menu payload. */
export const load: PageServerLoad = async ({ parent, locals }) => {
	const shell = await parent();
	if (!shell.tenantSlug) return { menu: null as StoreMenu | null, menuError: '' };
	try {
		const menu = await serverApi<StoreMenu>('/api/v1/public/menu', locals);
		return { menu, menuError: '' };
	} catch (err) {
		return { menu: null, menuError: err instanceof Error ? err.message : 'Menu unavailable' };
	}
};
