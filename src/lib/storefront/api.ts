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

export type StoreOptionGroup = {
	id: string;
	name: string;
	selection: 'single' | 'multiple';
	required: boolean;
	is_active: boolean;
	sort_order: number;
	options: StoreAddon[];
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
	option_groups?: StoreOptionGroup[];
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
	customer_login_mode: 'off' | 'optional' | 'required';
	/** Sign-in methods customers can use here: chosen by the owner and set up in Configuration. */
	customer_login_methods?: SignInMethod[];
	payment_requirement: string;
	auto_accept: boolean;
	ready_notification: boolean;
	order_ready_sound: string;
	store_status: string;
	status_message: string;
	store_status_label: string;
	status_message_display: string;
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
	/** Enabled capability codes. Older servers omit it. */
	capabilities?: string[];
	booking?: BookingSettings;
};

export type BookingSettings = {
	slot_step_minutes: number;
	lead_time_minutes: number;
	horizon_days: number;
	cancel_window_minutes: number;
	max_nights: number;
	requires_sign_in: boolean;
	payment: 'PAY_AT_VENUE';
};

export type StoreService = {
	id: string;
	name: string;
	duration_minutes: number;
	price: number;
};

export type StoreStaff = { id: string; name: string };

/** A bookable start time. `start` is an RFC 3339 instant. */
export type StoreSlot = { start: string; staff_id: string };

export type CustomerAppointment = {
	id: string;
	service_id: string;
	service_name: string;
	price: number;
	duration_minutes: number;
	staff_id: string;
	staff_name: string;
	scheduled_at: string;
	ends_at: string;
	status: string;
	notes: string;
	can_cancel: boolean;
	can_reschedule: boolean;
};

export type StoreRoomType = {
	id: string;
	name: string;
	description: string;
	image_url: string;
	base_price: number;
	max_guests: number;
	/** Only present when the request named dates. */
	available?: number;
	nights?: number;
	total?: number;
};

export type CustomerReservation = {
	id: string;
	room_type_id: string;
	room_type_name: string;
	image_url: string;
	check_in: string;
	check_out: string;
	guests: number;
	status: string;
	total_amount: number | null;
	notes: string;
	can_cancel: boolean;
};

export type StaySearch = { check_in: string; check_out: string; guests: number };

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
	/** Dummy payment: nobody was charged. */
	is_test?: boolean;
	refund_status?: string;
	refunded_amount?: number;
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

/** What the browser needs to open the gateway's payment window. */
export type PaymentCheckout = {
	gateway: 'razorpay';
	key_id: string;
	order_id: string;
	amount_minor: number;
	currency: string;
	name: string;
	description: string;
	prefill?: { contact?: string; email?: string };
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
	/** SANDBOX (dummy, nobody is charged) or LIVE. Absent on older servers. */
	payment_mode?: 'SANDBOX' | 'LIVE';
	is_test?: boolean;
	/** Present when a live gateway payment was just started: public values only. */
	checkout?: PaymentCheckout;
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

	sendOtp: (to: OtpTarget) =>
		api<{ method: SignInMethod; phone?: string; email?: string; otp: OtpState; expires_in: number }>(
			'/api/v1/auth/customer/send-otp',
			{ ...guest, method: 'POST', body: JSON.stringify(to) }
		),

	verifyOtp: (to: OtpTarget, code: string) =>
		api<{ tokens: CustomerTokens; customer: SessionCustomer; store_name: string }>(
			'/api/v1/auth/customer/verify-otp',
			{ ...guest, method: 'POST', body: JSON.stringify({ ...to, code }) }
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
		api<OrderDetail>(`/api/v1/customer/orders/${orderNumber}`, asCustomer(token)),

	services: () =>
		api<{ services: StoreService[]; staff: StoreStaff[] }>('/api/v1/public/services', guest),

	slots: (serviceId: string, date: string, staffId = '') => {
		const q = new URLSearchParams({ service_id: serviceId, date });
		if (staffId) q.set('staff_id', staffId);
		return api<{ slots: StoreSlot[] }>(`/api/v1/public/slots?${q}`, guest);
	},

	book: (
		payload: { service_id: string; staff_id: string; start: string; notes: string; client_token: string },
		token: string | null
	) =>
		api<CustomerAppointment>('/api/v1/public/appointments', {
			...asCustomer(token),
			method: 'POST',
			body: JSON.stringify(payload)
		}),

	appointments: (token: string | null) =>
		api<{ appointments: CustomerAppointment[] }>('/api/v1/customer/appointments', asCustomer(token)),

	cancelAppointment: (id: string, token: string | null) =>
		api<CustomerAppointment>(`/api/v1/customer/appointments/${encodeURIComponent(id)}/cancel`, {
			...asCustomer(token),
			method: 'POST'
		}),

	rescheduleAppointment: (id: string, payload: { start: string; staff_id: string }, token: string | null) =>
		api<CustomerAppointment>(`/api/v1/customer/appointments/${encodeURIComponent(id)}/reschedule`, {
			...asCustomer(token),
			method: 'POST',
			body: JSON.stringify(payload)
		}),

	roomTypes: (search?: StaySearch) => {
		const q = search
			? `?${new URLSearchParams({ check_in: search.check_in, check_out: search.check_out, guests: String(search.guests) })}`
			: '';
		return api<{ room_types: StoreRoomType[] }>(`/api/v1/public/room-types${q}`, guest);
	},

	reserve: (
		payload: StaySearch & { room_type_id: string; notes: string; client_token: string },
		token: string | null
	) =>
		api<CustomerReservation>('/api/v1/public/reservations', {
			...asCustomer(token),
			method: 'POST',
			body: JSON.stringify(payload)
		}),

	reservations: (token: string | null) =>
		api<{ reservations: CustomerReservation[] }>('/api/v1/customer/reservations', asCustomer(token)),

	cancelReservation: (id: string, token: string | null) =>
		api<CustomerReservation>(`/api/v1/customer/reservations/${encodeURIComponent(id)}/cancel`, {
			...asCustomer(token),
			method: 'POST'
		})
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
	email?: string;
	is_new: boolean;
};

export type SignInMethod = 'PHONE' | 'EMAIL';

/** Who a sign-in code goes to. */
export type OtpTarget = { phone: string; email?: never } | { email: string; phone?: never };

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
