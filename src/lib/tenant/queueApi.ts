import { api } from '$lib/api/client';

export type QueueStatus = 'WAITING' | 'CALLED' | 'IN_SERVICE' | 'COMPLETED' | 'CANCELLED';

export type QueueEntry = {
	id: string;
	queue_number: number;
	status: QueueStatus;
	appointment_id?: string;
	customer_id?: string;
};

export async function listQueue(): Promise<QueueEntry[]> {
	const data = await api<{ queue: QueueEntry[] }>('/api/v1/tenant/queue');
	return data.queue ?? [];
}

export async function joinQueue(customerId?: string): Promise<QueueEntry> {
	return api<QueueEntry>('/api/v1/tenant/queue', {
		method: 'POST',
		body: JSON.stringify(customerId ? { customer_id: customerId } : {})
	});
}

export async function callQueueEntry(id: string): Promise<QueueEntry> {
	return api<QueueEntry>(`/api/v1/tenant/queue/${id}/call`, { method: 'POST' });
}

export async function startQueueEntry(id: string): Promise<QueueEntry> {
	return api<QueueEntry>(`/api/v1/tenant/queue/${id}/start`, { method: 'POST' });
}

export async function completeQueueEntry(id: string): Promise<QueueEntry> {
	return api<QueueEntry>(`/api/v1/tenant/queue/${id}/complete`, { method: 'POST' });
}

export async function cancelQueueEntry(id: string): Promise<QueueEntry> {
	return api<QueueEntry>(`/api/v1/tenant/queue/${id}/cancel`, { method: 'POST' });
}
