import { api } from '$lib/api/client';

export type ReservationStatus = 'REQUESTED' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';

export type Reservation = {
	id: string;
	room_type_id: string;
	check_in_date: string;
	check_out_date: string;
	guests: number;
	status: ReservationStatus;
	customer_id?: string;
	room_id?: string;
};

export type CreateReservationPayload = {
	room_type_id: string;
	check_in_date: string;
	check_out_date: string;
	guests?: number;
	customer_id?: string;
};

export type Folio = { id: string; reservation_id: string; status: string };
export type Charge = { id: string; description: string; amount: number };

export async function listReservations(): Promise<Reservation[]> {
	const data = await api<{ reservations: Reservation[] }>('/api/v1/tenant/reservations');
	return data.reservations ?? [];
}

export async function createReservation(payload: CreateReservationPayload): Promise<Reservation> {
	return api<Reservation>('/api/v1/tenant/reservations', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

export async function confirmReservation(id: string): Promise<Reservation> {
	return api<Reservation>(`/api/v1/tenant/reservations/${id}/confirm`, { method: 'POST' });
}

export async function cancelReservation(id: string): Promise<Reservation> {
	return api<Reservation>(`/api/v1/tenant/reservations/${id}/cancel`, { method: 'POST' });
}

export async function noShowReservation(id: string): Promise<Reservation> {
	return api<Reservation>(`/api/v1/tenant/reservations/${id}/no-show`, { method: 'POST' });
}

export async function checkInReservation(id: string, roomId: string): Promise<{ reservation: Reservation; folio: Folio }> {
	return api(`/api/v1/tenant/reservations/${id}/check-in`, {
		method: 'POST',
		body: JSON.stringify({ room_id: roomId })
	});
}

export async function checkOutReservation(id: string): Promise<Reservation> {
	return api<Reservation>(`/api/v1/tenant/reservations/${id}/check-out`, { method: 'POST' });
}

export async function getFolio(reservationId: string): Promise<{ folio: Folio; charges: Charge[]; total: number }> {
	return api(`/api/v1/tenant/reservations/${reservationId}/folio`);
}

export async function addCharge(reservationId: string, description: string, amount: number): Promise<Charge> {
	return api<Charge>(`/api/v1/tenant/reservations/${reservationId}/folio/charges`, {
		method: 'POST',
		body: JSON.stringify({ description, amount })
	});
}
