import { api } from '$lib/api/client';

/**
 * Order history and the business activity feed.
 *
 * Filtering happens on the server: a shop that has been trading for a year has
 * more orders than a browser should hold, and the summary line has to count
 * every match rather than the page being shown.
 */

export type OrderHistoryRow = {
	id: string;
	order_number: number;
	status: string;
	source: string;
	customer_name: string;
	customer_phone: string;
	item_count: number;
	total: number;
	payment_status: string;
	payment_method: string;
	cancel_reason: string;
	created_at: string;
	completed_at: string | null;
	cancelled_at: string | null;
	/** Minutes from acceptance to ready, or null if it never got there. */
	prep_minutes: number | null;
};

export type OrderHistoryPage = {
	orders: OrderHistoryRow[];
	page: { limit: number; offset: number; total: number };
	summary: {
		total_orders: number;
		total_revenue: string;
		completed: number;
		cancelled: number;
	};
};

export type OrderHistoryQuery = {
	status?: string;
	source?: string;
	from?: string;
	to?: string;
	q?: string;
	limit?: number;
	offset?: number;
};

export async function fetchOrderHistory(query: OrderHistoryQuery = {}): Promise<OrderHistoryPage> {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value === undefined || value === null || value === '') continue;
		params.set(key, String(value));
	}
	const qs = params.toString();
	return api<OrderHistoryPage>(`/api/v1/tenant/order-history${qs ? `?${qs}` : ''}`);
}

export type ActivityEvent = {
	id: string;
	order_id: string;
	order_number: number;
	from_status: string;
	to_status: string;
	actor: string;
	customer_name: string;
	total: number;
	source: string;
	at: string;
};

export async function fetchActivity(status?: string): Promise<ActivityEvent[]> {
	const qs = status ? `?status=${encodeURIComponent(status)}` : '';
	const data = await api<{ events: ActivityEvent[] }>(`/api/v1/tenant/activity${qs}`);
	return data.events ?? [];
}

export type ShopAuditLog = {
	id: string;
	timestamp: string;
	actor: string;
	actor_email?: string;
	action: string;
	resource: string;
	resource_id?: string;
	tenant: string | null;
	result: string;
	metadata?: Record<string, unknown>;
};

export async function fetchShopAuditLogs(result?: string): Promise<ShopAuditLog[]> {
	const qs = result ? `?result=${encodeURIComponent(result)}` : '';
	const data = await api<{ audit_logs: ShopAuditLog[] }>(`/api/v1/tenant/audit-logs${qs}`);
	return data.audit_logs ?? [];
}
