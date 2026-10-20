import type { StaySearch, StoreMenu, StoreRoomType, StoreService, StoreStaff } from '$lib/storefront/api';
import { experienceFor } from '$lib/storefront/experience';
import { serverApi } from '$lib/storefront/server';
import type { PageServerLoad } from './$types';

/**
 * The home page loads what its kind of business shows first: the menu for a
 * shop, the service list for a booking business, the room types (with
 * availability when dates were searched) for a hotel. One request each, so
 * the first meaningful paint stays a single round trip.
 */
export const load: PageServerLoad = async ({ parent, locals, url }) => {
	const shell = await parent();
	const empty = {
		menu: null as StoreMenu | null,
		menuError: '',
		services: [] as StoreService[],
		staff: [] as StoreStaff[],
		roomTypes: [] as StoreRoomType[],
		stay: null as StaySearch | null
	};
	if (!shell.tenantSlug || !shell.config) return empty;

	const family = experienceFor(shell.config).family;
	try {
		if (family === 'book') {
			const res = await serverApi<{ services: StoreService[]; staff: StoreStaff[] }>(
				'/api/v1/public/services',
				locals
			);
			return { ...empty, services: res.services, staff: res.staff };
		}
		if (family === 'stay') {
			const checkIn = url.searchParams.get('check_in') ?? '';
			const checkOut = url.searchParams.get('check_out') ?? '';
			const guests = Number(url.searchParams.get('guests') ?? '2') || 2;
			const stay = checkIn && checkOut ? { check_in: checkIn, check_out: checkOut, guests } : null;
			const q = stay ? `?${new URLSearchParams({ ...stay, guests: String(guests) })}` : '';
			const res = await serverApi<{ room_types: StoreRoomType[] }>(`/api/v1/public/room-types${q}`, locals);
			return { ...empty, roomTypes: res.room_types, stay };
		}
		const menu = await serverApi<StoreMenu>('/api/v1/public/menu', locals);
		return { ...empty, menu };
	} catch (err) {
		// An unpublished or unreachable store gets a readable message rather than a
		// stack trace; the shell still renders its header and footer.
		return { ...empty, menuError: err instanceof Error ? err.message : 'This page is unavailable' };
	}
};
