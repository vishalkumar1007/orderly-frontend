import { api } from '$lib/api/client';

export type Service = {
	id: string;
	name: string;
	duration_minutes: number;
	price: number;
	is_active: boolean;
};

export type ServicePayload = {
	name: string;
	duration_minutes: number;
	price: number;
	is_active?: boolean;
};

export async function listServices(): Promise<Service[]> {
	const data = await api<{ services: Service[] }>('/api/v1/tenant/services');
	return data.services ?? [];
}

export async function createService(payload: ServicePayload): Promise<Service> {
	return api<Service>('/api/v1/tenant/services', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

export async function updateService(id: string, payload: Partial<ServicePayload>): Promise<Service> {
	return api<Service>(`/api/v1/tenant/services/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(payload)
	});
}

export async function deleteService(id: string): Promise<void> {
	await api(`/api/v1/tenant/services/${id}`, { method: 'DELETE' });
}

/** One weekly working range for a staff member. `weekday` is 0 for Sunday. */
export type StaffHours = {
	id: string;
	staff_id: string;
	weekday: number;
	start_time: string;
	end_time: string;
};

export async function listStaffHours(): Promise<StaffHours[]> {
	const data = await api<{ availability: StaffHours[] }>('/api/v1/tenant/staff-availability');
	return data.availability ?? [];
}

export async function addStaffHours(payload: Omit<StaffHours, 'id'>): Promise<StaffHours> {
	return api<StaffHours>('/api/v1/tenant/staff-availability', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

export async function removeStaffHours(id: string): Promise<void> {
	await api(`/api/v1/tenant/staff-availability/${id}`, { method: 'DELETE' });
}
