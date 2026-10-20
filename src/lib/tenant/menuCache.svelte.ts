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
let loadSeq = 0;

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

	const TIMEOUT_MS = 10_000;
	let timer: ReturnType<typeof setTimeout> | undefined;

	// A newer load may finish first; an older one must not overwrite it.
	const seq = ++loadSeq;
	const request = (async () => {
		const [c, pr, currency] = await Promise.all([
			menuApi.listCategories(),
			menuApi.listProducts(),
			storefrontAdminApi
				.get()
				.then((sf) => sf.store?.currency || cached?.currency || 'INR')
				.catch(() => cached?.currency ?? 'INR')
		]);
		const next: MenuSnapshot = {
			categories: c.categories,
			products: pr.products,
			currency,
			currencySymbol: currencySymbolFor(currency)
		};
		if (seq !== loadSeq && cached) return cached;
		cached = next;
		return next;
	})();

	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => {
			reject(new Error('Menu is taking too long to load. Check that the API is running and try again.'));
		}, TIMEOUT_MS);
	});

	const p = Promise.race([request, timeout]).finally(() => {
		if (timer) clearTimeout(timer);
		if (inflight === p) inflight = null;
	});

	inflight = p;
	return p;
}
