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
	/** Absolute storefront URL when the API provides one. */
	public_url?: string;
	is_published: boolean;
	status?: string;
	name: string;
	setup_status?: string;
	store_status: string;
	store_status_label?: string;
	status_message: string;
	ordering_open?: boolean;
};

/**
 * The launch checklist, as the API reports it.
 *
 * Every step is derived from real state on the server — there are no
 * optimistic defaults here. `required` lists the steps the product treats as
 * the minimum to launch, so the console can disable Publish rather than let an
 * owner put an empty shop in front of a customer.
 */
export type SetupStepKey =
	| 'business_info'
	| 'menu'
	| 'payment'
	| 'hours'
	| 'storefront'
	| 'staff'
	| 'launch';

export type DashboardSetup = {
	setup_status: string;
	is_published: boolean;
	steps: Record<SetupStepKey, boolean>;
	required: SetupStepKey[];
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

/**
 * Keep the dashboard hero in sync when status is changed from Action / Studio.
 * No-op when nothing is cached yet.
 */
export function patchDashboardStoreStatus(
	storeStatus: string,
	extras?: { status_message?: string; store_status_label?: string }
): void {
	if (!cached) return;
	const next = storeStatus || cached.store.store_status || 'OPEN';
	cached = {
		...cached,
		store: {
			...cached.store,
			store_status: next,
			ordering_open: next === 'OPEN' || next === 'BUSY',
			...(extras?.status_message !== undefined
				? { status_message: extras.status_message }
				: {}),
			...(extras?.store_status_label !== undefined
				? { store_status_label: extras.store_status_label }
				: {})
		}
	};
}

/** Prefer an absolute public_url; otherwise assemble from host + path. */
export function resolveStorefrontUrl(store: {
	public_url?: string;
	public_host?: string;
	public_path?: string;
}): string {
	const stripTrailingSlash = (u: string) => u.replace(/\/+$/, '');

	const direct = (store.public_url || '').trim();
	if (direct) {
		const absolute = /^https?:\/\//i.test(direct) ? direct : `http://${direct}`;
		return stripTrailingSlash(absolute);
	}
	const host = (store.public_host || '').trim();
	if (!host) return '';
	const path = store.public_path || '';
	if (/^https?:\/\//i.test(host)) return stripTrailingSlash(`${host}${path}`);
	return stripTrailingSlash(`http://${host}${path}`);
}

/** Scheme-stripped label for display (e.g. momo-magic.localhost:5173). */
export function storefrontUrlDisplay(url: string): string {
	return url.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

function normalizeStoreLink(
	raw: DashboardStoreLink,
	fromStorefront?: {
		store_status?: string;
		status_message?: string;
		store_status_label?: string;
	}
): DashboardStoreLink {
	const storeStatus =
		raw.store_status || fromStorefront?.store_status || 'OPEN';
	const statusMessage =
		raw.status_message ?? fromStorefront?.status_message ?? '';
	const statusLabel =
		raw.store_status_label ||
		fromStorefront?.store_status_label ||
		undefined;
	return {
		...raw,
		store_status: storeStatus,
		status_message: statusMessage,
		store_status_label: statusLabel,
		ordering_open:
			raw.ordering_open ?? (storeStatus === 'OPEN' || storeStatus === 'BUSY'),
		public_url: raw.public_url || resolveStorefrontUrl(raw) || undefined
	};
}

export function loadDashboardSnapshot(force = false): Promise<DashboardSnapshot> {
	if (!force && cached) return Promise.resolve(cached);
	if (!force && inflight) return inflight;

	const TIMEOUT_MS = 10_000;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const request = (async () => {
		const [stats, storeRaw, setup] = await Promise.all([
			api<DashboardStats>('/api/v1/tenant/dashboard'),
			api<DashboardStoreLink>('/api/v1/tenant/store-link'),
			api<DashboardSetup>('/api/v1/tenant/setup')
		]);
		let currency = cached?.currency ?? 'INR';
		let behaviour: {
			store_status?: string;
			status_message?: string;
			store_status_label?: string;
		} | undefined;
		try {
			const sf = await api<{
				store?: { currency?: string };
				behaviour?: {
					store_status?: string;
					status_message?: string;
					store_status_label?: string;
				};
			}>('/api/v1/tenant/storefront');
			if (sf.store?.currency) currency = sf.store.currency;
			behaviour = sf.behaviour;
		} catch {
			/* optional */
		}
		const store = normalizeStoreLink(storeRaw, behaviour);
		const next: DashboardSnapshot = { stats, store, setup, currency };
		cached = next;
		return next;
	})();

	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => {
			reject(
				new Error('Dashboard is taking too long to load. Check that the API is running and try again.')
			);
		}, TIMEOUT_MS);
	});

	const p = Promise.race([request, timeout]).finally(() => {
		if (timer) clearTimeout(timer);
		if (inflight === p) inflight = null;
	});

	inflight = p;
	return p;
}
