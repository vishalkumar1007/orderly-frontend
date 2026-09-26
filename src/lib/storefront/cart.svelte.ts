/**
 * The customer cart.
 *
 * A cart lives in `localStorage`, keyed by tenant slug, because a browser can
 * hold carts for several shops at once on different subdomains. It is
 * deliberately client-side only: nothing about an order is decided until the
 * server prices it, so a stale or tampered cart can cost a customer nothing but
 * a "that item is no longer available" message.
 *
 * A line is identified by its product *and* its chosen add-ons. Two "Veg Momo"
 * with different spice levels are two lines, because merging them would silently
 * change what the shop is asked to make.
 */

import { browser } from '$app/environment';
import type { CartAddon, StoreAddon, StoreProduct, QuoteRequest, CartTotals } from './api';

export type CartLine = {
	/** Stable identity for the line: product id plus the chosen add-on set. */
	key: string;
	product_id: string;
	name: string;
	price: number;
	image_url?: string;
	quantity: number;
	addons: CartAddon[];
	notes: string;
	available: boolean;
	/** Products with extras need the detail screen, so the card says so. */
	needs_options: boolean;
};

const KEY_PREFIX = 'orderly_cart_';
const VERSION = 2;

/** Guard rails. They mirror the server's so a cart cannot grow past what it
 *  would accept, and the server remains the authority. */
export const MAX_LINES = 40;
export const MAX_QTY_PER_LINE = 20;
export const MAX_TOTAL_QTY = 60;

function storageKey(slug: string): string {
	return `${KEY_PREFIX}${slug}:v${VERSION}`;
}

/** `lineKey` builds the identity of a line from its product and add-ons. */
export function lineKey(productId: string, addons: CartAddon[]): string {
	const suffix = [...addons]
		.filter((a) => a.quantity > 0)
		.sort((a, b) => a.id.localeCompare(b.id))
		.map((a) => `${a.id}x${a.quantity}`)
		.join(',');
	return suffix ? `${productId}::${suffix}` : productId;
}

/** `addonSelection` converts chosen add-ons into the request shape. */
export function addonSelection(addons: CartAddon[]): { id: string; quantity: number }[] {
	return addons.filter((a) => a.quantity > 0).map((a) => ({ id: a.id, quantity: a.quantity }));
}

/** `normaliseAddons` resolves chosen ids against the product's catalogue. */
export function normaliseAddons(
	catalogue: StoreAddon[],
	chosen: { id: string; quantity: number }[]
): CartAddon[] {
	return chosen
		.map((pick) => {
			const match = catalogue.find((a) => a.id === pick.id);
			if (!match) return null;
			const quantity = Math.max(0, Math.min(match.max_qty, Math.round(pick.quantity)));
			return quantity > 0
				? { id: match.id, name: match.name, price: match.price, quantity }
				: null;
		})
		.filter((a): a is CartAddon => a !== null);
}

/** `readCart` loads and repairs a persisted cart. */
export function readCart(slug: string): CartLine[] {
	if (!browser || !slug) return [];
	try {
		const raw = localStorage.getItem(storageKey(slug));
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.map(sanitiseLine)
			.filter((line): line is CartLine => line !== null)
			.slice(0, MAX_LINES);
	} catch {
		// A corrupt or unreadable cart is treated as empty. Refusing to start
		// would leave the customer unable to order at all.
		return [];
	}
}

function sanitiseLine(value: unknown): CartLine | null {
	if (!value || typeof value !== 'object') return null;
	const line = value as Record<string, unknown>;
	const productId = typeof line.product_id === 'string' ? line.product_id : '';
	const name = typeof line.name === 'string' ? line.name : '';
	const price = Number(line.price);
	const quantity = Number(line.quantity);
	if (!productId || !name || !Number.isFinite(price) || price < 0) return null;
	if (!Number.isInteger(quantity) || quantity < 1) return null;
	const addons = Array.isArray(line.addons)
		? line.addons
				.filter(
					(a): a is CartAddon =>
						Boolean(a) &&
						typeof (a as CartAddon).id === 'string' &&
						Number.isFinite((a as CartAddon).price) &&
						Number.isInteger((a as CartAddon).quantity) &&
					(a as CartAddon).quantity > 0
				)
				.map((a) => ({ ...a, quantity: Math.min(a.quantity, 20) }))
		: [];
	return {
		key: lineKey(productId, addons),
		product_id: productId,
		name,
		price,
		image_url: typeof line.image_url === 'string' ? line.image_url : undefined,
		quantity: Math.min(quantity, MAX_QTY_PER_LINE),
		addons,
		notes: typeof line.notes === 'string' ? line.notes.slice(0, 240) : '',
		available: line.available !== false,
		needs_options: Boolean(line.needs_options)
	};
}

export function writeCart(slug: string, lines: CartLine[]): void {
	if (!browser || !slug) return;
	try {
		if (!lines.length) {
			localStorage.removeItem(storageKey(slug));
			return;
		}
		localStorage.setItem(storageKey(slug), JSON.stringify(lines));
	} catch {
		// Private browsing or a full quota. The cart still works for this
		// session; it just will not survive a reload.
	}
}

export function clearCart(slug: string): void {
	if (!browser || !slug) return;
	try {
		localStorage.removeItem(storageKey(slug));
	} catch {
		/* nothing to do */
	}
}

/* -------------------------------------------------------------------------
   Local arithmetic
   ------------------------------------------------------------------------- */

/**
 * `estimateTotals` is the *display* total used before the server answers.
 *
 * It is intentionally an estimate: the cart screen shows it immediately, and the
 * server's own figure replaces it as soon as a quote comes back. Tax and
 * packaging are not guessed here — they arrive from `/public/quote` — so the
 * numbers a customer sees always trace back to something the server said.
 */
export function estimateTotals(
	lines: CartLine[],
	server?: { tax: number; packaging_fee: number; discount: number } | null
): CartTotals {
	const subtotal = round2(lines.reduce((sum, line) => sum + lineTotal(line), 0));
	return {
		subtotal,
		tax: server?.tax ?? 0,
		packaging_fee: server?.packaging_fee ?? 0,
		discount: server?.discount ?? 0,
		total: round2(subtotal + (server?.tax ?? 0) + (server?.packaging_fee ?? 0) - (server?.discount ?? 0))
	};
}

export function unitTotal(line: CartLine): number {
	const addons = line.addons.reduce((sum, a) => sum + a.price * a.quantity, 0);
	return round2(line.price + addons);
}

export function lineTotal(line: CartLine): number {
	return round2(unitTotal(line) * line.quantity);
}

export function cartCount(lines: CartLine[]): number {
	return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/** `quoteRequest` maps the cart into the payload the server prices. */
export function quoteRequest(lines: CartLine[]): QuoteRequest[] {
	return lines.map((line) => ({
		product_id: line.product_id,
		quantity: line.quantity,
		addons: addonSelection(line.addons),
		...(line.notes ? { notes: line.notes } : {})
	}));
}

/* -------------------------------------------------------------------------
   Mutations
   ------------------------------------------------------------------------- */

export type AddResult = { ok: true } | { ok: false; reason: string };

/** `addLine` adds or merges a line, refusing anything the cart cannot hold. */
export function addLine(
	lines: CartLine[],
	product: StoreProduct,
	quantity: number,
	addons: CartAddon[] = [],
	notes = ''
): { lines: CartLine[]; result: AddResult } {
	if (quantity < 1) return { lines, result: { ok: false, reason: 'Choose at least one' } };
	const key = lineKey(product.id, addons);
	const existing = lines.find((l) => l.key === key);
	const nextQuantity = (existing?.quantity ?? 0) + quantity;

	if (!existing && lines.length >= MAX_LINES) {
		return { lines, result: { ok: false, reason: 'Your cart is full' } };
	}
	if (nextQuantity > MAX_QTY_PER_LINE) {
		return { lines, result: { ok: false, reason: `Up to ${MAX_QTY_PER_LINE} per item` } };
	}
	if (cartCount(lines) + quantity > MAX_TOTAL_QTY) {
		return { lines, result: { ok: false, reason: 'That is a lot of food — please split the order' } };
	}

	const line: CartLine = {
		key,
		product_id: product.id,
		name: product.name,
		price: product.price,
		image_url: product.image_url,
		quantity: nextQuantity,
		addons,
		notes: notes.trim().slice(0, 240),
		available: product.is_available,
		needs_options: product.addons.length > 0
	};

	return {
		lines: existing ? lines.map((l) => (l.key === key ? line : l)) : [...lines, line],
		result: { ok: true }
	};
}

/** `setQuantity` replaces a line's quantity, dropping it at zero. */
export function setQuantity(lines: CartLine[], key: string, quantity: number): CartLine[] {
	if (quantity <= 0) return lines.filter((l) => l.key !== key);
	return lines.map((line) =>
		line.key === key ? { ...line, quantity: Math.min(quantity, MAX_QTY_PER_LINE) } : line
	);
}

/** `changeQuantity` steps a line by `delta`. */
export function changeQuantity(lines: CartLine[], key: string, delta: number): CartLine[] {
	const line = lines.find((l) => l.key === key);
	if (!line) return lines;
	return setQuantity(lines, key, line.quantity + delta);
}

export function removeLine(lines: CartLine[], key: string): CartLine[] {
	return lines.filter((l) => l.key !== key);
}

export function quantityOf(lines: CartLine[], productId: string): number {
	return lines
		.filter((l) => l.product_id === productId)
		.reduce((sum, l) => sum + l.quantity, 0);
}

export function hasLineFor(lines: CartLine[], productId: string): boolean {
	return lines.some((l) => l.product_id === productId);
}

function round2(value: number): number {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}
