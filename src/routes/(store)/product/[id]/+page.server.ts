import { error } from '@sveltejs/kit';
import type { StoreProduct } from '$lib/storefront/api';
import { serverApi } from '$lib/storefront/server';
import type { PageServerLoad } from './$types';

/**
 * A product detail page.
 *
 * The product is loaded server-side so the first paint already has the name,
 * price and add-ons: the screen a customer lands on from a shared link must not
 * flash empty before its data arrives.
 */
export const load: PageServerLoad = async ({ params, parent, locals }) => {
	const shell = await parent();
	if (!shell.tenantSlug) return { product: null as StoreProduct | null, ordering: null };

	try {
		const data = await serverApi<{
			product: StoreProduct;
			ordering: { enabled: boolean; closed_reason: string };
		}>(`/api/v1/public/products/${encodeURIComponent(params.id)}`, locals);
		return { product: data.product, ordering: data.ordering };
	} catch {
		// A product that has been taken off sale is a 404 for the customer, not a
		// crash: the id is simply no longer orderable.
		throw error(404, 'That item is no longer available');
	}
};
