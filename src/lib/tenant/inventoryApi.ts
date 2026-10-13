import { api } from '$lib/api/client';

export type StockStatus = 'OK' | 'LOW' | 'OUT' | 'PAUSED' | 'UNTRACKED';

/** One product with its stock state, as GET /api/v1/tenant/inventory returns it. */
export type StockRow = {
	product_id: string;
	product_name: string;
	category: string;
	price: number;
	/** Whether the storefront currently shows it. */
	is_available: boolean;
	tracked: boolean;
	status: StockStatus;
	// Present only when tracked.
	quantity?: number;
	unit?: string;
	reorder_threshold?: number;
	track?: boolean;
	/** Stock (not the owner) hid this product; restocking shows it again. */
	auto_disabled?: boolean;
	updated_at?: string;
};

export type StockSummary = Record<StockStatus, number>;

export type StockMovement = {
	id: string;
	delta: number;
	quantity_after: number;
	reason: 'INITIAL' | 'ADD' | 'WASTE' | 'CORRECTION' | 'ORDER' | 'CANCEL';
	note: string;
	actor: string;
	order_number?: number;
	created_at: string;
};

export type AdjustReason = 'ADD' | 'WASTE' | 'CORRECTION';

/**
 * `quiet`: a plan without inventory is shown as a locked screen by the page,
 * not as the global upgrade dialog on top of it.
 */
export async function listStock(): Promise<{ items: StockRow[]; summary: StockSummary }> {
	return api('/api/v1/tenant/inventory', { quiet: true });
}

export async function trackProduct(
	productId: string,
	payload: { quantity?: number; unit?: string; reorder_threshold?: number; track?: boolean }
): Promise<StockRow> {
	return api(`/api/v1/tenant/inventory/${productId}`, {
		method: 'PUT',
		body: JSON.stringify(payload)
	});
}

export async function adjustStock(
	productId: string,
	payload: { reason: AdjustReason; quantity: number; note?: string }
): Promise<StockRow> {
	return api(`/api/v1/tenant/inventory/${productId}/adjust`, {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

export async function stockMovements(productId: string): Promise<StockMovement[]> {
	const data = await api<{ movements: StockMovement[] }>(
		`/api/v1/tenant/inventory/${productId}/movements?limit=100`
	);
	return data.movements ?? [];
}

/** What a movement reason is called on screen. */
export const REASON_LABEL: Record<StockMovement['reason'], string> = {
	INITIAL: 'Started tracking',
	ADD: 'Stock added',
	WASTE: 'Written off',
	CORRECTION: 'Stock count',
	ORDER: 'Sold',
	CANCEL: 'Order cancelled'
};

export const UNITS = ['pcs', 'plates', 'portions', 'bottles', 'packs', 'cups', 'kg', 'litres'];
