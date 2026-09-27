import { api, ApiClientError, getAccessToken, getRefreshToken } from '$lib/api/client';

export type OrderItemAddon = { name: string; price?: number; quantity?: number };

export type OrderItem = {
	product_name: string;
	quantity: number;
	unit_price?: number;
	subtotal?: number;
	notes?: string;
	addons?: OrderItemAddon[];
};

export type OrderPayment = {
	id: string;
	status: string;
	method: string;
	amount?: number;
	paid_at?: string;
};

export type Order = {
	id: string;
	order_number: number;
	status: string;
	status_label?: string;
	total: number;
	customer_name: string;
	customer_phone?: string;
	items: OrderItem[];
	payment: OrderPayment | null;
	can_cancel?: boolean;
	created_at?: string;
	updated_at?: string;
};

export type OrderStage = {
	key: string;
	label: string;
	/** Verb on the card's primary button, i.e. move the order *to* this stage. */
	action: string;
	actionLabel: string;
	/** Short label for the phone tab bar. */
	short: string;
};

export type CounterOrderLine = {
	product_id: string;
	quantity: number;
	addons?: { id: string; quantity: number }[];
	notes?: string;
};

export type CounterOrderPayload = {
	customer_name: string;
	customer_phone: string;
	customer_email?: string;
	notes?: string;
	payment_method?: string;
	client_token: string;
	items: CounterOrderLine[];
};

/** How aggressively the shared board should poll. */
export type OrderPollMode = 'ops' | 'badge';

/** The happy path, in order. Drives both the board and the phone tabs. */
export const STAGES: OrderStage[] = [
	{ key: 'PENDING', label: 'New orders', action: 'accept', actionLabel: 'Accept', short: 'New' },
	{ key: 'ACCEPTED', label: 'Accepted', action: 'prepare', actionLabel: 'Start preparing', short: 'Accepted' },
	{ key: 'PREPARING', label: 'Preparing', action: 'ready', actionLabel: 'Mark ready', short: 'Preparing' },
	{ key: 'READY', label: 'Ready for pickup', action: 'complete', actionLabel: 'Complete', short: 'Ready' }
];

/** Destination label after a stage action succeeds. */
export function stageAfterAction(action: string): string {
	const map: Record<string, string> = {
		accept: 'Accepted',
		prepare: 'Preparing',
		ready: 'Ready',
		complete: 'Completed',
		cancel: 'Cancelled'
	};
	return map[action] ?? action;
}

const LIVE = new Set(STAGES.map((s) => s.key));

const OPS_LIVE_MS = 5000;
const OPS_IDLE_MS = 20000;
const BADGE_MS = 60000;
const BACKOFF_START_MS = 5000;
const BACKOFF_CAP_MS = 60000;

/** Coerce staff (or legacy) list payloads into the board Order shape. */
export function normalizeOrder(raw: Record<string, unknown>): Order {
	const itemsRaw = Array.isArray(raw.items) ? raw.items : [];
	const items: OrderItem[] = itemsRaw.map((row) => {
		const item = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
		const name =
			(typeof item.product_name === 'string' && item.product_name) ||
			(typeof item.name === 'string' && item.name) ||
			'Item';
		const addons = Array.isArray(item.addons)
			? (item.addons as Record<string, unknown>[]).map((a) => ({
					name: typeof a.name === 'string' ? a.name : 'Add-on',
					price: typeof a.price === 'number' ? a.price : undefined,
					quantity: typeof a.quantity === 'number' ? a.quantity : undefined
				}))
			: undefined;
		return {
			product_name: name,
			quantity: typeof item.quantity === 'number' ? item.quantity : Number(item.quantity) || 0,
			unit_price: typeof item.unit_price === 'number' ? item.unit_price : undefined,
			subtotal: typeof item.subtotal === 'number' ? item.subtotal : undefined,
			notes: typeof item.notes === 'string' ? item.notes : undefined,
			addons
		};
	});

	let total = 0;
	if (typeof raw.total === 'number') total = raw.total;
	else if (raw.totals && typeof raw.totals === 'object') {
		const totals = raw.totals as Record<string, unknown>;
		if (typeof totals.total === 'number') total = totals.total;
	}

	let payment: OrderPayment | null = null;
	if (raw.payment && typeof raw.payment === 'object') {
		const p = raw.payment as Record<string, unknown>;
		const id = typeof p.id === 'string' ? p.id : '';
		if (id) {
			payment = {
				id,
				status: typeof p.status === 'string' ? p.status : '',
				method: typeof p.method === 'string' ? p.method : '',
				amount: typeof p.amount === 'number' ? p.amount : undefined,
				paid_at: typeof p.paid_at === 'string' ? p.paid_at : undefined
			};
		}
	}

	return {
		id: typeof raw.id === 'string' ? raw.id : '',
		order_number: typeof raw.order_number === 'number' ? raw.order_number : Number(raw.order_number) || 0,
		status: typeof raw.status === 'string' ? raw.status : '',
		status_label: typeof raw.status_label === 'string' ? raw.status_label : undefined,
		total,
		customer_name: typeof raw.customer_name === 'string' ? raw.customer_name : '',
		customer_phone: typeof raw.customer_phone === 'string' ? raw.customer_phone : undefined,
		items,
		payment,
		can_cancel: typeof raw.can_cancel === 'boolean' ? raw.can_cancel : undefined,
		created_at: typeof raw.created_at === 'string' ? raw.created_at : undefined,
		updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : undefined
	};
}

/**
 * Shared live order board.
 *
 * `/shop/orders` and `/shop/kitchen` are two views of the same data, so they share
 * one poller instead of each hitting the API on their own timer. Polling is
 * reference-counted (stops when no screen is showing it) and pauses while the
 * tab is hidden, which matters a lot for operators on phones.
 *
 * Two modes share the same data:
 * - `ops` — Selling / Kitchen / Live (5s live / 20s idle)
 * - `badge` — shop shell topbar (60s) so non-ops pages do not hammer the API
 */
class OrderBoard {
	orders = $state<Order[]>([]);
	error = $state('');
	loading = $state(true);
	/** Order ids with an in-flight transition, so buttons can disable. */
	busy = $state<Record<string, boolean>>({});
	lastSync = $state<number | null>(null);
	offline = $state(false);

	#opsSubscribers = 0;
	#badgeSubscribers = 0;
	#timer: ReturnType<typeof setTimeout> | undefined;
	#onVisibility: (() => void) | undefined;
	#inflight = false;
	#backoffMs = 0;
	#authStopped = false;

	get #subscriberCount(): number {
		return this.#opsSubscribers + this.#badgeSubscribers;
	}

	/** New orders awaiting a decision — the number that actually matters. */
	get newCount(): number {
		return this.orders.filter((o) => o.status === 'PENDING').length;
	}

	/** Everything not yet completed. */
	get activeCount(): number {
		return this.orders.filter((o) => LIVE.has(o.status)).length;
	}

	get hasLive(): boolean {
		return this.activeCount > 0;
	}

	countFor(stage: string): number {
		return this.orders.filter((o) => o.status === stage).length;
	}

	forStage(stage: string): Order[] {
		// Newest first — the operator's next job is almost always the latest.
		return this.orders.filter((o) => o.status === stage).slice().reverse();
	}

	isBusy(id: string): boolean {
		return Boolean(this.busy[id]);
	}

	stageFor(status: string): OrderStage | undefined {
		return STAGES.find((s) => s.key === status);
	}

	/**
	 * Register interest. Polling starts on the first subscriber.
	 * Pass `'badge'` from the shop shell; ops pages use the default `'ops'`.
	 */
	acquire(mode: OrderPollMode = 'ops') {
		if (mode === 'ops') this.#opsSubscribers += 1;
		else this.#badgeSubscribers += 1;

		if (this.#subscriberCount === 1) {
			this.#authStopped = false;
			this.#backoffMs = 0;
			if (typeof document !== 'undefined') {
				this.#onVisibility = () => {
					if (!document.hidden) void this.refresh();
					else this.#stopTimer();
				};
				document.addEventListener('visibilitychange', this.#onVisibility);
			}
			// refresh()'s finally schedules the next tick — do not double-schedule here.
			void this.refresh();
			return;
		}

		// A new ops subscriber may need a faster cadence than badge-only.
		this.#schedule();
	}

	release(mode: OrderPollMode = 'ops') {
		if (mode === 'ops') this.#opsSubscribers = Math.max(0, this.#opsSubscribers - 1);
		else this.#badgeSubscribers = Math.max(0, this.#badgeSubscribers - 1);

		if (this.#subscriberCount === 0) {
			this.#stopTimer();
			if (this.#onVisibility && typeof document !== 'undefined') {
				document.removeEventListener('visibilitychange', this.#onVisibility);
				this.#onVisibility = undefined;
			}
			return;
		}

		// Dropping ops may fall back to the slower badge interval.
		this.#schedule();
	}

	async refresh() {
		if (this.#inflight) return;
		if (this.#authStopped) return;
		if (!getAccessToken() && !getRefreshToken()) {
			this.#authStopped = true;
			this.loading = false;
			this.#stopTimer();
			return;
		}

		this.#inflight = true;
		let shouldReschedule = true;
		try {
			const data = await api<{ orders: Record<string, unknown>[] }>('/api/v1/tenant/orders');
			this.orders = (data.orders ?? []).map((row) => normalizeOrder(row));
			this.error = '';
			this.lastSync = Date.now();
			this.#backoffMs = 0;
			this.#authStopped = false;
		} catch (err) {
			// Leave the last good board on screen; just flag that it is stale.
			this.error = err instanceof Error ? err.message : 'Could not refresh orders';
			if (err instanceof ApiClientError && err.status === 401) {
				this.#authStopped = true;
				shouldReschedule = false;
				this.#stopTimer();
			} else {
				this.#backoffMs =
					this.#backoffMs === 0
						? BACKOFF_START_MS
						: Math.min(this.#backoffMs * 2, BACKOFF_CAP_MS);
			}
		} finally {
			this.#inflight = false;
			this.loading = false;
			if (shouldReschedule) this.#schedule();
		}
	}

	async transition(order: Order, action: string) {
		if (!order.id) throw new Error('Order is missing an id');
		return this.#mutate(order.id, () =>
			api(`/api/v1/tenant/orders/${order.id}/${action}`, { method: 'POST' })
		);
	}

	async cancel(order: Order, reason = '') {
		if (!order.id) throw new Error('Order is missing an id');
		return this.#mutate(order.id, () =>
			api(`/api/v1/tenant/orders/${order.id}/cancel`, {
				method: 'POST',
				body: JSON.stringify(reason ? { reason } : {})
			})
		);
	}

	async confirmPay(order: Order) {
		if (!order.payment?.id) throw new Error('Payment is missing an id');
		return this.#mutate(order.id, () =>
			api(`/api/v1/tenant/payments/${order.payment!.id}/confirm`, { method: 'POST' })
		);
	}

	async createCounterOrder(payload: CounterOrderPayload) {
		const created = await api<Record<string, unknown>>('/api/v1/tenant/orders', {
			method: 'POST',
			body: JSON.stringify(payload)
		});
		await this.refresh();
		return normalizeOrder(created);
	}

	/**
	 * Run a mutation, then reconcile. We refresh rather than patch the local
	 * copy so the board can never disagree with the server about status.
	 */
	async #mutate(orderId: string, run: () => Promise<unknown>) {
		this.busy = { ...this.busy, [orderId]: true };
		try {
			await run();
			await this.refresh();
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Update failed';
			throw err;
		} finally {
			const next = { ...this.busy };
			delete next[orderId];
			this.busy = next;
		}
	}

	/**
	 * Ops polls fast while there is work; badge-only stays at 60s so the rest of
	 * the console does not keep a phone radio busy. Error backoff overrides both.
	 */
	#schedule() {
		this.#stopTimer();
		if (this.#subscriberCount === 0 || this.#authStopped) return;
		if (typeof document !== 'undefined' && document.hidden) return;

		let delay: number;
		if (this.#backoffMs > 0) {
			delay = this.#backoffMs;
		} else if (this.#opsSubscribers > 0) {
			delay = this.hasLive ? OPS_LIVE_MS : OPS_IDLE_MS;
		} else {
			delay = BADGE_MS;
		}
		this.#timer = setTimeout(() => void this.refresh(), delay);
	}

	#stopTimer() {
		if (this.#timer) clearTimeout(this.#timer);
		this.#timer = undefined;
	}
}

export const orderBoard = new OrderBoard();
