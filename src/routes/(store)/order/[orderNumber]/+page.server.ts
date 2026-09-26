import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** The order number is the only thing the route needs. */
export const load: PageServerLoad = async ({ params }) => {
	const value = Number(params.orderNumber);
	if (!Number.isInteger(value) || value <= 0) {
		throw error(404, 'That order number is not valid');
	}
	return { orderNumber: value };
};
