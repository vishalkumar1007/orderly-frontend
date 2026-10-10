import { api } from '$lib/api/client';

export type RoomStatus =
	| 'AVAILABLE'
	| 'RESERVED'
	| 'OCCUPIED'
	| 'CHECKOUT_PENDING'
	| 'CLEANING'
	| 'INSPECTION';

export type RoomType = {
	id: string;
	name: string;
	base_price: number;
	max_guests: number;
};

export type RoomTypePayload = {
	name: string;
	base_price: number;
	max_guests?: number;
};

export type Room = {
	id: string;
	room_type_id: string;
	number: string;
	status: RoomStatus;
};

export async function listRoomTypes(): Promise<RoomType[]> {
	const data = await api<{ room_types: RoomType[] }>('/api/v1/tenant/room-types');
	return data.room_types ?? [];
}

export async function createRoomType(payload: RoomTypePayload): Promise<RoomType> {
	return api<RoomType>('/api/v1/tenant/room-types', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

export async function updateRoomType(id: string, payload: Partial<RoomTypePayload>): Promise<RoomType> {
	return api<RoomType>(`/api/v1/tenant/room-types/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(payload)
	});
}

export async function deleteRoomType(id: string): Promise<void> {
	await api(`/api/v1/tenant/room-types/${id}`, { method: 'DELETE' });
}

export async function listRooms(): Promise<Room[]> {
	const data = await api<{ rooms: Room[] }>('/api/v1/tenant/rooms');
	return data.rooms ?? [];
}

export async function createRoom(roomTypeId: string, number: string): Promise<Room> {
	return api<Room>('/api/v1/tenant/rooms', {
		method: 'POST',
		body: JSON.stringify({ room_type_id: roomTypeId, number })
	});
}

export async function setRoomStatus(id: string, status: RoomStatus): Promise<Room> {
	return api<Room>(`/api/v1/tenant/rooms/${id}/status`, {
		method: 'POST',
		body: JSON.stringify({ status })
	});
}
