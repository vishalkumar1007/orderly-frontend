import { error } from '@sveltejs/kit';
import type { StaySearch, StoreRoomType } from '$lib/storefront/api';
import { serverApi } from '$lib/storefront/server';
import type { PageServerLoad } from './$types';

/** One room type, with availability and the stay's price when dates are set. */
export const load: PageServerLoad = async ({ params, parent, locals, url }) => {
	const shell = await parent();
	if (!shell.tenantSlug) throw error(404, 'Not found');
	const checkIn = url.searchParams.get('check_in') ?? '';
	const checkOut = url.searchParams.get('check_out') ?? '';
	const guests = Number(url.searchParams.get('guests') ?? '2') || 2;
	const stay: StaySearch | null = checkIn && checkOut ? { check_in: checkIn, check_out: checkOut, guests } : null;
	const q = stay ? `?${new URLSearchParams({ check_in: checkIn, check_out: checkOut, guests: String(guests) })}` : '';
	let rooms: StoreRoomType[];
	let searchError = '';
	try {
		rooms = (await serverApi<{ room_types: StoreRoomType[] }>(`/api/v1/public/room-types${q}`, locals)).room_types;
	} catch (err) {
		// Bad dates still show the room; the page explains what to fix.
		searchError = err instanceof Error ? err.message : 'Those dates do not work.';
		rooms = (await serverApi<{ room_types: StoreRoomType[] }>('/api/v1/public/room-types', locals).catch(() => ({
			room_types: [] as StoreRoomType[]
		}))).room_types;
	}
	const room = rooms.find((r) => r.id === params.roomTypeId);
	if (!room) throw error(404, 'That room is no longer offered');
	return { room, stay: searchError ? null : stay, searchError };
};
