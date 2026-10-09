import { api } from '$lib/api/client';

export type AppointmentStatus =
	| 'REQUESTED'
	| 'CONFIRMED'
	| 'CHECKED_IN'
	| 'WAITING'
	| 'IN_SERVICE'
	| 'COMPLETED'
	| 'CANCELLED'
	| 'NO_SHOW';

export type Appointment = {
	id: string;
	service_id: string;
	scheduled_at: string;
	status: AppointmentStatus;
	customer_id?: string;
	staff_id?: string;
};

export type CreateAppointmentPayload = {
	service_id: string;
	scheduled_at: string;
	staff_id?: string;
	customer_id?: string;
};

export async function listAppointments(): Promise<Appointment[]> {
	const data = await api<{ appointments: Appointment[] }>('/api/v1/tenant/appointments');
	return data.appointments ?? [];
}

export async function createAppointment(payload: CreateAppointmentPayload): Promise<Appointment> {
	return api<Appointment>('/api/v1/tenant/appointments', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

export async function confirmAppointment(id: string): Promise<Appointment> {
	return api<Appointment>(`/api/v1/tenant/appointments/${id}/confirm`, { method: 'POST' });
}

export async function checkinAppointment(
	id: string
): Promise<{ appointment: Appointment; queue_entry: { id: string; queue_number: number } }> {
	return api(`/api/v1/tenant/appointments/${id}/checkin`, { method: 'POST' });
}

export async function cancelAppointment(id: string): Promise<Appointment> {
	return api<Appointment>(`/api/v1/tenant/appointments/${id}/cancel`, { method: 'POST' });
}

export async function noShowAppointment(id: string): Promise<Appointment> {
	return api<Appointment>(`/api/v1/tenant/appointments/${id}/no-show`, { method: 'POST' });
}
