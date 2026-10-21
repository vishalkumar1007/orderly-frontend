import { api } from '$lib/api/client';

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING';

export type DiningTable = {
	id: string;
	label: string;
	seats: number;
	status: TableStatus;
};

/** The moves the API allows, mirroring internal/tables/handler.go. */
export const TABLE_TRANSITIONS: Record<TableStatus, TableStatus[]> = {
	AVAILABLE: ['OCCUPIED', 'RESERVED'],
	RESERVED: ['OCCUPIED', 'AVAILABLE'],
	OCCUPIED: ['CLEANING'],
	CLEANING: ['AVAILABLE']
};

export async function listTables(): Promise<DiningTable[]> {
	const data = await api<{ tables: DiningTable[] }>('/api/v1/tenant/tables');
	return data.tables ?? [];
}

export async function createTable(label: string, seats: number): Promise<DiningTable> {
	return api<DiningTable>('/api/v1/tenant/tables', {
		method: 'POST',
		body: JSON.stringify({ label, seats })
	});
}

export async function setTableStatus(id: string, status: TableStatus): Promise<DiningTable> {
	return api<DiningTable>(`/api/v1/tenant/tables/${id}/status`, {
		method: 'POST',
		body: JSON.stringify({ status })
	});
}

export async function deleteTable(id: string): Promise<void> {
	await api(`/api/v1/tenant/tables/${id}`, { method: 'DELETE' });
}
