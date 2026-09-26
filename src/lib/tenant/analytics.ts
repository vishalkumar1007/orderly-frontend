import { api } from '$lib/api/client';

export type AnalyticsWindow = '7d' | '14d' | '30d' | '90d';

export type DayPoint = { day: string; order_count: number; revenue: number };
export type HourPoint = { hour: number; order_count: number };
export type ProductPoint = { name: string; units: number; revenue: number };
export type StatusPoint = { status: string; count: number };

export type TenantAnalytics = {
	window: AnalyticsWindow;
	days: number;

	orders_today: number;
	revenue_today: number;
	orders_7d: number;
	revenue_7d: number;
	orders_30d: number;
	revenue_30d: number;

	orders_prev_30d: number;
	revenue_prev_30d: number;

	pending_orders: number;
	preparing_orders: number;
	ready_orders: number;
	completed_today: number;

	avg_order_value_30d: number;

	products_available: number;
	products_unavailable: number;

	orders_by_day: DayPoint[];
	orders_by_hour: HourPoint[];
	top_products: ProductPoint[];
	status_breakdown: StatusPoint[];
};

export async function fetchTenantAnalytics(
	window: AnalyticsWindow = '30d'
): Promise<TenantAnalytics> {
	return api<TenantAnalytics>(`/api/v1/tenant/analytics?window=${window}`);
}

/** Percentage change from `prev` to `current`, guarding the zero cases. */
export function percentChange(current: number, prev: number): {
	pct: number;
	dir: 'up' | 'down' | 'flat';
} {
	if (prev <= 0) {
		// No prior data: a rise from nothing is real, a fall from nothing is not.
		if (current > 0) return { pct: 100, dir: 'up' };
		return { pct: 0, dir: 'flat' };
	}
	const pct = Math.round(((current - prev) / prev) * 100);
	if (pct > 0) return { pct, dir: 'up' };
	if (pct < 0) return { pct: Math.abs(pct), dir: 'down' };
	return { pct: 0, dir: 'flat' };
}
