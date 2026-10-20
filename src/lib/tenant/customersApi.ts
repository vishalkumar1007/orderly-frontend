import { api } from '$lib/api/client';

export type ShopCustomer = {
	id: string | null;
	kind: 'registered' | 'guest';
	name: string;
	phone: string;
	email: string;
	is_blocked: boolean;
	last_login_at: string | null;
	created_at: string | null;
	order_count: number;
	total_spend: number;
	last_order_at: string | null;
};

export type ShopCustomerOrder = {
	id: string;
	order_number: number;
	status: string;
	total: number;
	customer_name: string;
	created_at: string | null;
};

export type ShopCustomerStats = {
	order_count: number;
	total_spend: number;
	average_order: number;
	first_order_at: string | null;
	last_order_at: string | null;
};

export type ShopCustomerDetail = {
	customer: ShopCustomer;
	stats: ShopCustomerStats;
	orders: ShopCustomerOrder[];
};

export type CustomerEvent = {
	kind: 'login' | 'order' | 'appointment' | 'stay' | 'admin';
	status: string;
	ref: string;
	amount: number;
	detail: string;
	at: string;
};

export async function listShopCustomers(
	q = '',
	offset = 0,
	limit = 50
): Promise<{
	customers: ShopCustomer[];
	counts: { registered: number; guest: number; total: number };
	has_more: boolean;
}> {
	const p = new URLSearchParams({ limit: String(limit), offset: String(offset) });
	if (q.trim()) p.set('q', q.trim());
	return api(`/api/v1/tenant/customers?${p}`);
}

export async function getShopCustomerActivity(
	id: string,
	before?: string
): Promise<{ events: CustomerEvent[]; has_more: boolean }> {
	const p = new URLSearchParams({ limit: '50' });
	if (before) p.set('before', before);
	return api(`/api/v1/tenant/customers/${id}/activity?${p}`);
}

export async function getShopCustomer(id: string): Promise<ShopCustomerDetail> {
	return api(`/api/v1/tenant/customers/${id}`);
}

export async function getShopGuestCustomer(phone: string): Promise<ShopCustomerDetail> {
	return api(`/api/v1/tenant/customers/guest?phone=${encodeURIComponent(phone)}`);
}

export async function setShopCustomerBlocked(
	id: string,
	blocked: boolean
): Promise<{ id: string; name: string; phone: string; is_blocked: boolean }> {
	return api(`/api/v1/tenant/customers/${id}/block`, {
		method: 'POST',
		body: JSON.stringify({ blocked })
	});
}
