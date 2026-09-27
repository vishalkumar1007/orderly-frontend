import { api } from '$lib/api/client';

/**
 * In-memory cache for the shop dashboard payload.
 *
 * Leaving Dashboard for Orders/Menu and coming back remounts `+page.svelte`.
 * Without a cache that remount always starts with loading=true and a full-pane
 * skeleton — which reads as "UI stuck loading" even when the Go APIs are fast.
 * Serve the last payload immediately and refresh in the background.
 */

export type DashboardStats = {
	orders_today: number;
	revenue_today: string;
	pending_orders: number;
	preparing_orders: number;
	ready_orders: number;
	completed_today: number;
};

export type DashboardStoreLink = {
	slug: string;
	public_path: string;
	public_host: string;
	is_published: boolean;
	status: string;
	name: string;
	setup_status: string;
	store_status: string;
	status_message: string;
};

export type DashboardSetup = {
	setup_status: string;
	is_published: boolean;
	steps: { business_info: boolean; menu: boolean; payment: boolean; qr: boolean; launch: boolean };
};

export type DashboardSnapshot = {
	stats: DashboardStats;
	store: DashboardStoreLink;
	setup: DashboardSetup;
	currency: string;
};

let cached = $state<DashboardSnapshot | null>(null);
let inflight: Promise<DashboardSnapshot> | null = null;

export function getDashboardSnapshot(): DashboardSnapshot | null {
	return cached;
}

export function setDashboardSnapshot(next: DashboardSnapshot | null): void {
	cached = next;
}

export function invalidateDashboardSnapshot(): void {
	cached = null;
}

export function loadDashboardSnapshot(force = false): Promise<DashboardSnapshot> {
	if (!force && cached) return Promise.resolve(cached);
	if (!force && inflight) return inflight;

	const p = (async () => {
		const [stats, store, setup] = await Promise.all([
			api<DashboardStats>('/api/v1/tenant/dashboard'),
			api<DashboardStoreLink>('/api/v1/tenant/store-link'),
			api<DashboardSetup>('/api/v1/tenant/setup')
		]);
		let currency = cached?.currency ?? 'INR';
		try {
			const sf = await api<{ store?: { currency?: string } }>('/api/v1/tenant/storefront');
			if (sf.store?.currency) currency = sf.store.currency;
		} catch {
			/* optional */
		}
		const next: DashboardSnapshot = { stats, store, setup, currency };
		cached = next;
		return next;
	})().finally(() => {
		if (inflight === p) inflight = null;
	});

	inflight = p;
	return p;
}
