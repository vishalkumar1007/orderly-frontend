/**
 * Cart state for the storefront shell.
 *
 * The cart is a `$state` rune rather than a store so the header badge, the
 * sticky cart bar and the cart page all read one live value and re-render
 * without any manual subscription. It is created once per storefront layout and
 * handed to the pages through context.
 */
import { getContext, setContext } from 'svelte';
import {
	addLine as addLineTo,
	cartCount,
	changeQuantity,
	clearCart,
	estimateTotals,
	quantityOf,
	readCart,
	removeLine,
	setQuantity,
	writeCart,
	type AddResult,
	type CartLine
} from './cart.svelte';
import type { CartAddon, CartTotals, StoreProduct } from './api';

export type CartState = {
	slug: string;
	lines: CartLine[];
	/** Server-priced totals, once a quote has arrived. */
	totals: CartTotals | null;
	/** Message from the last add attempt, for a transient toast. */
	notice: string;
	count: number;
	add: (product: StoreProduct, quantity?: number, addons?: CartAddon[], notes?: string) => AddResult;
	setQty: (key: string, quantity: number) => void;
	step: (key: string, delta: number) => void;
	remove: (key: string) => void;
	empty: () => void;
	quantityOf: (productId: string) => number;
	/** Estimated totals for display before the server has quoted. */
	estimate: () => CartTotals;
	setTotals: (totals: CartTotals | null) => void;
	sync: (lines: CartLine[]) => void;
	setNotice: (msg: string) => void;
};

const KEY = 'orderly:cart';

export function createCart(slug: string, initial: CartLine[]): CartState {
	let lines = $state<CartLine[]>(initial);
	let totals = $state<CartTotals | null>(null);
	let notice = $state('');

	const state: CartState = {
		get slug() {
			return slug;
		},
		get lines() {
			return lines;
		},
		get totals() {
			return totals;
		},
		get notice() {
			return notice;
		},
		get count() {
			return cartCount(lines);
		},
		add(product, quantity = 1, addons: CartAddon[] = [], notes = '') {
			const outcome = addLineTo(lines, product, quantity, addons, notes);
			lines = outcome.lines;
			writeCart(slug, lines);
			notice = outcome.result.ok ? `${product.name} added` : outcome.result.reason;
			return outcome.result;
		},
		setQty(key, quantity) {
			lines = setQuantity(lines, key, quantity);
			writeCart(slug, lines);
		},
		step(key, delta) {
			lines = changeQuantity(lines, key, delta);
			writeCart(slug, lines);
		},
		remove(key) {
			lines = removeLine(lines, key);
			writeCart(slug, lines);
		},
		empty() {
			lines = [];
			totals = null;
			clearCart(slug);
		},
		quantityOf: (productId) => quantityOf(lines, productId),
		estimate: () => totals ?? estimateTotals(lines),
		setTotals(next) {
			totals = next;
		},
		sync(next) {
			lines = next;
			writeCart(slug, lines);
		},
		setNotice(msg: string) {
			notice = msg;
		}
	};

	return state;
}

export function loadInitialCart(slug: string | null): CartLine[] {
	return slug ? readCart(slug) : [];
}

export function provideCart(state: CartState): CartState {
	setContext(KEY, state);
	return state;
}

export function useCart(): CartState {
	const state = getContext<CartState>(KEY);
	if (!state) {
		throw new Error('useCart() was called outside the storefront layout');
	}
	return state;
}
