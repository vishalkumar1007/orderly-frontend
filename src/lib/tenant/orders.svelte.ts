import { api } from '$lib/api/client';

export type OrderItem = { product_name: string; quantity: number };

export type Order = {
	id: string;
	order_number: number;
	status: string;
	total: number;
	customer_name: string;
	items: OrderItem[];
	payment: { id: string; status: string; method: string } | null;
	created_at?: string;
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

/** The happy path, in order. Drives both the board and the phone tabs. */
export const STAGES: OrderStage[] = [
	{ key: 'PENDING', label: 'New orders', action: 'accept', actionLabel: 'Accept', short: 'New' },
	{ key: 'ACCEPTED', label: 'Accepted', action: 'prepare', actionLabel: 'Start preparing', short: 'Accepted' },
	{ key: 'PREPARING', label: 'Preparing', action: 'ready', actionLabel: 'Mark ready', short: 'Preparing' },
	{ key: 'READY', label: 'Ready for pickup', action: 'complete', actionLabel: 'Complete', short: 'Ready' }
];

const LIVE = new Set(STAGES.map((s) => s.key));

/**
 * Shared live order board.
 *
 * `/shop/orders` and `/kitchen` are two views of the same data, so they share
 * one poller instead of each hitting the API on their own timer. Polling is
 * reference-counted (stops when no screen is showing it) and pauses while the
 * tab is hidden, which matters a lot for operators on phones.
 */
class OrderBoard {
	orders = $state<Order[]>([]);
	error = $state('');
	loading = $state(true);
	/** Order ids with an in-flight transition, so buttons can disable. */
	busy = $state<Record<string, boolean>>({});
	lastSync = $state<number | null>(null);
	offline = $state(false);

	#subscribers = 0;
	#timer: ReturnType<typeof setTimeout> | undefined;
	#onVisibility: (() => void) | undefined;

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

	/** Register interest. Polling starts on the first subscriber. */
	acquire() {
		this.#subscribers += 1;
		if (this.#subscribers === 1) {
			if (typeof document !== 'undefined') {
				this.#onVisibility = () => {
					// Come back fresh rather than serving a stale board.
					if (!document.hidden) void this.refresh();
					else this.#stopTimer();
				};
				document.addEventListener('visibilitychange', this.#onVisibility);
			}
			void this.refresh();
			this.#schedule();
		}
	}

	release() {
		this.#subscribers = Math.max(0, this.#subscribers - 1);
		if (this.#subscribers === 0) this.#stopTimer();
	}

	async refresh() {
		try {
			const data = await api<{ orders: Order[] }>('/api/v1/tenant/orders');
			this.orders = data.orders;
			this.error = '';
			this.lastSync = Date.now();
		} catch (err) {
			// Leave the last good board on screen; just flag that it is stale.
			this.error = err instanceof Error ? err.message : 'Could not refresh orders';
		} finally {
			this.loading = false;
			this.#schedule();
		}
	}

	async transition(order: Order, action: string) {
		return this.#mutate(order.id, () =>
			api(`/api/v1/tenant/orders/${order.id}/${action}`, { method: 'POST' })
		);
	}

	async confirmPay(order: Order) {
		if (!order.payment) return;
		const paymentId = order.payment.id;
		return this.#mutate(order.id, () =>
			api(`/api/v1/tenant/payments/${paymentId}/confirm`, { method: 'POST' })
		);
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
	 * Poll fast while there is work on the board and slowly when idle — a
	 * finished shop should not keep a phone's radio busy all evening.
	 */
	#schedule() {
		this.#stopTimer();
		if (this.#subscribers === 0) return;
		if (typeof document !== 'undefined' && document.hidden) return;
		const delay = this.hasLive ? 5000 : 20000;
		this.#timer = setTimeout(() => void this.refresh(), delay);
	}

	#stopTimer() {
		if (this.#timer) clearTimeout(this.#timer);
		this.#timer = undefined;
	}
}

export const orderBoard = new OrderBoard();
