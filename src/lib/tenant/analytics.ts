import { api } from '$lib/api/client';

export type AnalyticsWindow = '7d' | '14d' | '30d' | '90d';

/** How the trend chart groups days. */
export type Granularity = 'day' | 'week' | 'month';

export type DayPoint = { day: string; order_count: number; revenue: number };
/** `revenue` is the average money taken in that hour on one day. */
export type HourPoint = { hour: number; order_count: number; revenue: number };
/** Orders in one weekday (0 = Monday) and hour cell, on the shop's clock. */
export type WeekHourPoint = { weekday: number; hour: number; order_count: number };
export type ProductPoint = { name: string; units: number; revenue: number };
export type CategoryPoint = { name: string; units: number; revenue: number };
export type StatusPoint = { status: string; count: number };

/** One way customers paid over the window, with its share of orders. */
export type PaymentPoint = {
	method: string;
	status: string;
	order_count: number;
	revenue: number;
	share: number;
};

export type TenantAnalytics = {
	window: AnalyticsWindow;
	days: number;
	/** Bucket size of `orders_by_period`. */
	granularity: Granularity;

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

	/**
	 * Operational quality. Median prep time is the headline because one ticket
	 * left open all afternoon would drag the mean somewhere unrecognisable.
	 */
	median_prep_minutes: number;
	avg_prep_minutes: number;
	avg_accept_minutes: number;
	/** Completed ÷ ALL orders, including ones still in the kitchen. Prefer `fulfilment_rate`. */
	completion_rate: number;
	cancellation_rate: number;
	cancelled_today: number;
	/** Over the window. */
	completed_orders: number;
	cancelled_orders: number;
	/** Completed ÷ (completed + cancelled), as a percentage. Null until an order has finished. */
	fulfilment_rate: number | null;

	/** Always one point per day. */
	orders_by_day: DayPoint[];
	/** The same data grouped by `granularity`; `day` is the first day of each bucket. */
	orders_by_period: DayPoint[];
	/** The window immediately before this one, paired with `orders_by_day` by index. */
	orders_prev_by_day: DayPoint[];
	orders_by_hour: HourPoint[];
	/** Older servers omit it. */
	orders_by_weekday_hour?: WeekHourPoint[];
	/** The shop's timezone, which every day and hour is in. */
	timezone?: string;
	top_products: ProductPoint[];
	/** The same sales ranked by revenue instead of volume. */
	top_products_by_revenue: ProductPoint[];
	top_categories: CategoryPoint[];
	payment_mix: PaymentPoint[];
	status_breakdown: StatusPoint[];

	/** All customers on the books, including those who did not order in this window. */
	customers_total: number;
	/** Customers who ordered in the window and joined during it. */
	customers_new: number;
	/** Customers who ordered in the window and joined before it. */
	customers_returning: number;
	/** Everyone identified who ordered in the window. New + returning. */
	customers_active: number;
	/** Share of active customers who ordered more than once, or null when nobody did. */
	repeat_customer_rate: number | null;
};

export async function fetchTenantAnalytics(
	window: AnalyticsWindow = '30d',
	granularity: Granularity = 'day'
): Promise<TenantAnalytics> {
	// quiet: the dashboard shows its own "not in your plan" panel, not the dialog.
	return api<TenantAnalytics>(`/api/v1/tenant/analytics?window=${window}&granularity=${granularity}`, { quiet: true });
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
