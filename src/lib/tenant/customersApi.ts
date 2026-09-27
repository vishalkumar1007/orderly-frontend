import { api } from '$lib/api/client';

export type ShopCustomer = {
	id: string | null;
	kind: 'registered' | 'guest';
	name: string;
	phone: string;
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

export type ShopCustomerDetail = {
	customer: ShopCustomer;
	orders: ShopCustomerOrder[];
};

export async function listShopCustomers(q = ''): Promise<{
	customers: ShopCustomer[];
	counts: { registered: number; guest: number; total: number };
}> {
	const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
	return api(`/api/v1/tenant/customers${qs}`);
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
