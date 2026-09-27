import { storefrontAdminApi } from '$lib/storefront/admin';
import { menuApi, type MenuCategory, type MenuProduct } from '$lib/tenant/menu';

/**
 * In-memory cache for the shop menu editor.
 *
 * Same remount problem as the dashboard: navigating away and back always
 * flashed a full-pane skeleton even though categories/products were already
 * fetched seconds earlier.
 */

export type MenuSnapshot = {
	categories: MenuCategory[];
	products: MenuProduct[];
	currency: string;
	currencySymbol: string;
};

let cached = $state<MenuSnapshot | null>(null);
let inflight: Promise<MenuSnapshot> | null = null;

export function getMenuSnapshot(): MenuSnapshot | null {
	return cached;
}

export function setMenuSnapshot(next: MenuSnapshot | null): void {
	cached = next;
}

export function invalidateMenuSnapshot(): void {
	cached = null;
}

function currencySymbolFor(currency: string): string {
	try {
		return (
			new Intl.NumberFormat('en-IN', {
				style: 'currency',
				currency,
				currencyDisplay: 'narrowSymbol',
				maximumFractionDigits: 0
			})
				.formatToParts(0)
				.find((x) => x.type === 'currency')?.value ?? '₹'
		);
	} catch {
		return '₹';
	}
}

export function loadMenuSnapshot(force = false): Promise<MenuSnapshot> {
	if (!force && cached) return Promise.resolve(cached);
	if (!force && inflight) return inflight;

	const p = (async () => {
		const [c, pr] = await Promise.all([menuApi.listCategories(), menuApi.listProducts()]);
		let currency = cached?.currency ?? 'INR';
		try {
			const sf = await storefrontAdminApi.get();
			if (sf.store?.currency) currency = sf.store.currency;
		} catch {
			/* optional */
		}
		const next: MenuSnapshot = {
			categories: c.categories,
			products: pr.products,
			currency,
			currencySymbol: currencySymbolFor(currency)
		};
		cached = next;
		return next;
	})().finally(() => {
		if (inflight === p) inflight = null;
	});

	inflight = p;
	return p;
}
