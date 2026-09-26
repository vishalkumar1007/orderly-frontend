/**
 * Storefront data types and the storefront API client.
 *
 * Two rules shape this file:
 *
 * 1. The tenant is never sent. It comes from the hostname the browser is on, and
 *    the server resolves it from the Host header. There is no `tenant_id` field
 *    anywhere in a request the storefront makes.
 * 2. Prices from the server are authoritative. The client renders what the API
 *    returned and never recomputes a total that will be charged.
 */

import { api, ApiClientError, type ApiOptions } from '$lib/api/client';
import type { StoreTheme } from './theme';

/**
 * `guest` marks a call that must never carry a credential. Browsing, the
 * storefront config, the menu and guest checkout all use it, so a leftover
 * staff token in localStorage can never be attached to a public request.
 */
const guest: ApiOptions = { authToken: null };

/** `asCustomer` attaches a diner's session token, or nothing for a guest. */
export function asCustomer(token: string | null): ApiOptions {
	return token ? { authToken: token } : { authToken: null };
}

export type StoreAddon = {
	id: string;
	name: string;
	price: number;
	max_qty: number;
};

export type StoreProduct = {
	id: string;
	category_id: string;
	name: string;
	description: string;
	price: number;
	image_url?: string;
	is_available: boolean;
	is_vegetarian: boolean;
	is_featured: boolean;
	is_popular: boolean;
	allow_special_instructions: boolean;
	addons: StoreAddon[];
	sort_order: number;
};

export type StoreCategory = {
	id: string;
	name: string;
	description: string;
	sort_order: number;
	products: StoreProduct[];
};

export type StoreMenu = {
	store: { name: string; slug: string };
	categories: StoreCategory[];
	products: StoreProduct[];
	ordering: { enabled: boolean; closed_reason: string };
};

export type StoreIdentity = {
	name: string;
	slug: string;
	logo_url: string;
	favicon_url: string;
	tagline: string;
	description: string;
	phone: string;
	address: string;
	business_type: string;
	currency: string;
};

export type HomepageSection = {
	id: string;
	type: string;
	enabled: boolean;
	content: Record<string, string>;
};

export type StoreHours = {
	always_open: boolean;
	is_open: boolean;
	label: string;
	detail: string;
	timezone: string;
	schedule: Record<string, string[]>;
	today_closes?: string;
};

export type StoreOrdering = {
	enabled: boolean;
	closed_reason: string;
	prep_time_minutes: number;
	customer_login: boolean;
	payment_requirement: string;
	auto_accept: boolean;
};

export type StorePayments = {
	online_payment_enabled: boolean;
	cash_enabled: boolean;
	pay_at_pickup_enabled: boolean;
	default_payment_method: string;
	methods: string[];
};

export type StoreConfig = {
	store: StoreIdentity;
	theme: StoreTheme;
	homepage: { sections: HomepageSection[] };
	payments: StorePayments;
	ordering: StoreOrdering;
	hours: StoreHours;
	preview: boolean;
};

export type CartTotals = {
	subtotal: number;
	tax: number;
	packaging_fee: number;
	discount: number;
	total: number;
};

/** Alias kept for readability at call sites that talk about an order. */
export type OrderTotals = CartTotals;

export type OrderItem = {
	id: string;
	name: string;
	quantity: number;
	unit_price: number;
	subtotal: number;
	addons?: CartAddon[];
	notes?: string;
};

export type CartAddon = { id: string; name: string; price: number; quantity: number };

export type TimelineStep = {
	key: string;
	label: string;
	state: 'DONE' | 'CURRENT' | 'UPCOMING';
	at?: string;
};

export type OrderPayment = {
	method: string;
	status: string;
	amount: number;
	attempts?: number;
	paid_at?: string;
	failure_reason?: string;
};

export type OrderSummary = {
	order_number: number;
	reference: string;
	status: string;
	status_label: string;
	total: number;
	item_count: number;
	items: { name: string; quantity: number }[];
	created_at: string;
	is_active: boolean;
	can_cancel: boolean;
	tracking_path: string;
	payment_status?: string;
	payment_method?: string;
	ready_at?: string;
};

export type OrderDetail = {
	order_number: number;
	reference: string;
	status: string;
	status_label: string;
	order_type: string;
	is_active: boolean;
	can_cancel: boolean;
	timeline: TimelineStep[];
	items: OrderItem[];
	totals: { subtotal: number; tax: number; packaging_fee: number; discount: number; total: number };
	customer_name: string;
	phone_masked: string;
	store: { name: string; address: string; phone: string };
	created_at: string;
	estimated_ready_at?: string;
	payment_required: boolean;
	pay_at_pickup?: boolean;
	payment?: OrderPayment;
	payment_methods: string[];
	can_pay_online: boolean;
	payment_path?: string;
	duplicate?: boolean;
	next_step?: 'pay' | 'confirmation';
	confirmation_path?: string;
};

export type QuoteLine = {
	product_id: string;
	name: string;
	quantity: number;
	unit_price: number;
	unit_total: number;
	line_total: number;
	addons: CartAddon[];
	notes: string;
};

export type Quote = { items: QuoteLine[]; totals: CartTotals; currency: string };

export type CustomerProfile = {
	customer: {
		id: string;
		name: string;
		phone: string;
		phone_full: string;
		joined: string;
		last_login_at?: string;
	};
	active_orders: OrderSummary[];
	recent_orders: OrderSummary[];
	total_orders: number;
	benefits: string[];
};

export type PaymentSession = {
	order_number: number;
	order_status: string;
	order_status_label: string;
	method: string;
	payment_status: string;
	amount: number;
	currency: string;
	store_name: string;
	payment_methods: string[];
	can_pay_online: boolean;
	payable: boolean;
	payment_token?: string;
	failure_reason?: string;
	attempts?: number;
	outcome?: 'SUCCESS' | 'FAILURE';
	message?: string;
	can_retry?: boolean;
	created_at: string;
};

/** The storefront API surface. All calls are tenant-host scoped by the origin. */
export const storefrontApi = {
	config: () => api<StoreConfig>('/api/v1/public/store', guest),

	menu: () => api<StoreMenu>('/api/v1/public/menu', guest),

	product: (id: string) =>
		api<{ product: StoreProduct; ordering: { enabled: boolean; closed_reason: string } }>(
			`/api/v1/public/products/${encodeURIComponent(id)}`,
			guest
		),

	quote: (items: QuoteRequest[]) =>
		api<Quote>('/api/v1/public/quote', { ...guest, method: 'POST', body: JSON.stringify({ items }) }),

	/**
	 * `createOrder` may carry a customer token, which links the order to the
	 * signed-in profile so it shows up in their history. Without one it is an
	 * ordinary guest order and nothing else changes.
	 */
	createOrder: (payload: CreateOrderRequest, token: string | null = null) =>
		api<OrderDetail>('/api/v1/public/orders', {
			...asCustomer(token),
			method: 'POST',
			body: JSON.stringify(payload)
		}),

	/** `trackOrder` needs either a customer token or the checkout phone. */
	trackOrder: (orderNumber: number, opts: { phone?: string; token?: string | null } = {}) => {
		const query = opts.phone ? `?phone=${encodeURIComponent(opts.phone)}` : '';
		return api<OrderDetail>(`/api/v1/public/orders/${orderNumber}${query}`, asCustomer(opts.token ?? null));
	},

	lookupOrders: (phone: string) =>
		api<{ orders: OrderSummary[] }>(
			`/api/v1/public/orders/lookup?phone=${encodeURIComponent(phone)}`,
			guest
		),

	startPayment: (
		orderNumber: number,
		method: string,
		opts: { phone?: string; token?: string | null } = {}
	) =>
		api<PaymentSession>(`/api/v1/public/orders/${orderNumber}/pay`, {
			...asCustomer(opts.token ?? null),
			method: 'POST',
			body: JSON.stringify({ method, ...(opts.phone ? { phone: opts.phone } : {}) })
		}),

	confirmPayment: (
		orderNumber: number,
		payload: { outcome: 'SUCCESS' | 'FAILURE'; token: string; reason?: string; phone?: string },
		customerToken: string | null = null
	) =>
		api<PaymentSession>(`/api/v1/public/orders/${orderNumber}/pay/confirm`, {
			...asCustomer(customerToken),
			method: 'POST',
			body: JSON.stringify(payload)
		}),

	paymentStatus: (orderNumber: number, opts: { phone?: string; token?: string | null } = {}) => {
		const query = opts.phone ? `?phone=${encodeURIComponent(opts.phone)}` : '';
		return api<PaymentSession>(
			`/api/v1/public/orders/${orderNumber}/pay${query}`,
			asCustomer(opts.token ?? null)
		);
	},

	sendOtp: (phone: string) =>
		api<{ phone: string; otp: OtpState; expires_in: number }>('/api/v1/auth/customer/send-otp', {
			...guest,
			method: 'POST',
			body: JSON.stringify({ phone })
		}),

	verifyOtp: (phone: string, code: string) =>
		api<{ tokens: CustomerTokens; customer: SessionCustomer; store_name: string }>(
			'/api/v1/auth/customer/verify-otp',
			{ ...guest, method: 'POST', body: JSON.stringify({ phone, code }) }
		),

	profile: (token: string | null) => api<CustomerProfile>('/api/v1/customer/profile', asCustomer(token)),

	updateProfile: (name: string, token: string | null) =>
		api<CustomerProfile>('/api/v1/customer/profile', {
			...asCustomer(token),
			method: 'PUT',
			body: JSON.stringify({ name })
		}),

	orders: (token: string | null) =>
		api<{ orders: OrderSummary[] }>('/api/v1/customer/orders', asCustomer(token)),

	order: (orderNumber: number, token: string | null) =>
		api<OrderDetail>(`/api/v1/customer/orders/${orderNumber}`, asCustomer(token))
};

export type OtpState = {
	expires_in: number;
	resend_in: number;
	attempts: number;
	max_attempts: number;
	can_resend: boolean;
	/** Only ever present outside production, where no SMS provider is wired. */
	dev_code?: string;
};

export type CustomerTokens = {
	access_token: string;
	refresh_token: string;
	token_type: string;
	expires_in: number;
};

export type SessionCustomer = {
	id: string;
	name: string;
	phone: string;
	phone_full: string;
	is_new: boolean;
};

export type QuoteRequest = {
	product_id: string;
	quantity: number;
	addons: { id: string; quantity: number }[];
	notes?: string;
};

export type CreateOrderRequest = {
	customer_name: string;
	customer_phone: string;
	customer_email?: string;
	notes?: string;
	payment_method: string;
	/**
	 * Idempotency key. One per checkout session, reused on retry, so a double
	 * tap or a refresh returns the original order instead of placing a second.
	 */
	client_token: string;
	items: QuoteRequest[];
};

/** `friendlyError` turns an API failure into something a customer can read. */
export function friendlyError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
	if (error instanceof ApiClientError) {
		switch (error.code) {
			case 'product_unavailable':
				return 'One of the items in your cart is no longer available.';
			case 'store_closed':
				return error.message || 'This store is closed right now.';
			case 'network_error':
				return 'You appear to be offline. Check your connection and try again.';
			case 'phone_required':
				return 'Enter the phone number you used to place this order.';
			case 'order_not_found':
				return 'We could not find that order. Check the order number and phone number.';
			case 'too_many_attempts':
			case 'resend_too_soon':
			case 'rate_limited':
				return error.message;
		}
		if (error.status >= 500) {
			return 'We hit a problem on our side. Please try again in a moment.';
		}
		return error.message || fallback;
	}
	if (error instanceof Error && error.message) return error.message;
	return fallback;
}
