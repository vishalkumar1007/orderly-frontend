/**
 * Shared storefront formatting.
 *
 * Money is formatted in one place so a price never appears as "₹340.0" on one
 * screen and "₹340" on another. The API already returns 2-decimal numbers; this
 * only decides how they are shown.
 */

export const CURRENCY_SYMBOLS: Record<string, string> = {
	INR: '₹',
	USD: '$',
	EUR: '€',
	GBP: '£',
	AED: 'AED ',
	SGD: 'S$',
	MYR: 'RM ',
	ZAR: 'R'
};

export function currencySymbol(currency: string | undefined | null): string {
	if (!currency) return '₹';
	return CURRENCY_SYMBOLS[currency.toUpperCase()] ?? `${currency} `;
}

/** `money` formats an amount without trailing zeroes: 340, 340.5. */
export function money(amount: number, currency = 'INR'): string {
	const value = Number.isFinite(amount) ? amount : 0;
	const symbol = currencySymbol(currency);
	// Whole amounts read better without ".00" on a phone screen.
	return `${symbol}${trimZeros(value.toFixed(2))}`;
}

/** `moneyPrecise` always shows both decimals, for totals that need them. */
export function moneyPrecise(amount: number, currency = 'INR'): string {
	const value = Number.isFinite(amount) ? amount : 0;
	return `${currencySymbol(currency)}${value.toFixed(2)}`;
}

function trimZeros(value: string): string {
	return value.includes('.') ? value.replace(/\.?0+$/, '') : value;
}

/** `itemSummary` reads as "2 × Veg Momo" for a compact line. */
export function itemSummary(quantity: number, name: string): string {
	return `${quantity} × ${name}`;
}

/** `orderCode` is the short reference a customer reads at the counter. */
export function orderCode(reference: string | undefined, orderNumber: number): string {
	return reference && reference.trim() ? reference.trim() : `#${orderNumber}`;
}

/** `timeOfDay` formats an ISO timestamp as a plain local time. */
export function timeOfDay(iso: string | undefined | null): string {
	if (!iso) return '';
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '';
	return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** `relativeTime` reads as "2 min ago", for order lists. */
export function relativeTime(iso: string | undefined | null): string {
	if (!iso) return '';
	const then = new Date(iso).getTime();
	if (Number.isNaN(then)) return '';
	const seconds = Math.round((Date.now() - then) / 1000);
	if (seconds < 45) return 'just now';
	if (seconds < 90) return 'a minute ago';
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes} min ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours} hr ago`;
	const days = Math.round(hours / 24);
	if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
	return new Date(iso).toLocaleDateString();
}

/** `minutesUntil` renders an estimate as "in 18 min". */
export function minutesUntil(iso: string | undefined | null): string {
	if (!iso) return '';
	const at = new Date(iso).getTime();
	if (Number.isNaN(at)) return '';
	const minutes = Math.round((at - Date.now()) / 60000);
	if (minutes <= 0) return 'any moment now';
	if (minutes < 60) return `in ${minutes} min`;
	const hours = Math.floor(minutes / 60);
	return `in ${hours} hr ${minutes % 60} min`;
}

/** `prepEstimate` is what the confirmation screen shows before a time exists. */
export function prepEstimate(minutes: number): string {
	if (minutes <= 0) return 'a few minutes';
	if (minutes < 60) return `${minutes} min`;
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

/** `formatPhone` groups a number for display without changing its digits. */
export function formatPhone(phone: string): string {
	const digits = phone.replace(/[^\d+]/g, '');
	if (digits.startsWith('+91') && digits.length === 13) {
		return `+91 ${digits.slice(3, 8)} ${digits.slice(8)}`;
	}
	if (digits.length === 10) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
	return phone;
}
