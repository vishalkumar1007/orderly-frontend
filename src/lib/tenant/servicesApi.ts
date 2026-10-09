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
