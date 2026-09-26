export type CartItem = {
	product_id: string;
	name: string;
	price: number;
	quantity: number;
};

const KEY = 'orderly_cart';

function storageKey(slug: string) {
	return `${KEY}_${slug}`;
}

export function loadCart(slug: string): CartItem[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		return JSON.parse(localStorage.getItem(storageKey(slug)) || '[]');
	} catch {
		return [];
	}
}

export function saveCart(slug: string, items: CartItem[]) {
	localStorage.setItem(storageKey(slug), JSON.stringify(items));
}

export function clearCart(slug: string) {
	localStorage.removeItem(storageKey(slug));
}

export function cartTotal(items: CartItem[]) {
	return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}
