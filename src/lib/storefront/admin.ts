/**
 * Tenant admin storefront configuration — types and API.
 *
 * The admin screens are deliberately thin. Every value here is validated by the
 * server against a closed catalogue, and a rejected value comes back as a
 * specific error the form can show next to the field that caused it. The client
 * mirrors the enums only so the pickers can render — it is not the authority.
 */

import { api, ApiClientError } from '$lib/api/client';
import type { StoreConfig } from './api';
import type { StoreTheme } from './theme';

/** A homepage section as the admin editor holds it. */
export type AdminSection = {
	id: string;
	type: string;
	enabled: boolean;
	content: Record<string, string>;
};

export type SectionField = {
	key: string;
	label: string;
	type: 'text' | 'textarea' | 'image' | 'number';
	hint?: string;
	max?: number;
};

export type SectionTypeDef = {
	type: string;
	label: string;
	blurb: string;
	fields: SectionField[];
};

export type ThemePreset = {
	id: string;
	name: string;
	blurb: string;
	primary: string;
	secondary: string;
	accent: string;
	font: string;
	radius: string;
	button_style: string;
	card_style: string;
	header_style: string;
	hero_style: string;
	mode: string;
};

export type AdminStorefront = {
	store: {
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
		timezone: string;
	};
	theme: StoreTheme & { hero_image_url: string; vars: Record<string, string> };
	behaviour: {
		ordering_enabled: boolean;
		closed_message: string;
		customer_login_enabled: boolean;
		customer_login_mode: 'off' | 'optional' | 'required';
		prep_time_minutes: number;
		tax_percent: number;
		packaging_fee: number;
		published: boolean;
		store_status: string;
	};
	payments: {
		online_payment_enabled: boolean;
		cash_enabled: boolean;
		pay_at_pickup_enabled: boolean;
		default_payment_method: string;
		methods: string[];
	};
	workflow: {
		acceptance_mode: string;
		payment_requirement: string;
		ready_notification: boolean;
		auto_complete: boolean;
	};
	hours: {
		always_open: boolean;
		timezone: string;
		schedule: Record<string, string[]>;
		days: string[];
		is_open: boolean;
		label: string;
		detail: string;
		today_closes: string;
	};
	homepage: { sections: AdminSection[] };
	catalogues: {
		presets: ThemePreset[];
		section_types: SectionTypeDef[];
		days: string[];
	};
	ordering_available_now: boolean;
	closed_reason: string;
	public_url: string;
	updated_at: string;
};

export type AdminQr = {
	url: string;
	host: string;
	published: boolean;
	download_name: string;
	qr: { url: string; png: string; svg: string; size: number };
};

/** Retry only when the primary path is missing (older backends). Never mask auth/validation. */
async function withStorefrontFallback<T>(primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
	try {
		return await primary();
	} catch (err) {
		if (err instanceof ApiClientError && err.status === 404) {
			return fallback();
		}
		throw err;
	}
}

export const storefrontAdminApi = {
	get: () =>
		withStorefrontFallback(
			() => api<AdminStorefront>('/api/v1/tenant/customize'),
			() => api<AdminStorefront>('/api/v1/tenant/storefront')
		),

	saveIdentity: (payload: {
		name?: string;
		logo_url?: string;
		favicon_url?: string;
		tagline?: string;
		description?: string;
		phone?: string;
		address?: string;
	}) =>
		withStorefrontFallback(
			() =>
				api<AdminStorefront>('/api/v1/tenant/customize', {
					method: 'PUT',
					body: JSON.stringify(payload)
				}),
			() =>
				api<AdminStorefront>('/api/v1/tenant/storefront', {
					method: 'PUT',
					body: JSON.stringify(payload)
				})
		),

	saveBehaviour: (payload: {
		ordering_enabled?: boolean;
		closed_message?: string;
		customer_login_enabled?: boolean;
		customer_login_mode?: 'off' | 'optional' | 'required';
		prep_time_minutes?: number;
		tax_percent?: number | string;
		packaging_fee?: number | string;
		published?: boolean;
		store_status?: string;
		status_message?: string;
	}) =>
		withStorefrontFallback(
			() =>
				api<AdminStorefront>('/api/v1/tenant/customize', {
					method: 'PUT',
					body: JSON.stringify(payload)
				}),
			() =>
				api<AdminStorefront>('/api/v1/tenant/storefront', {
					method: 'PUT',
					body: JSON.stringify(payload)
				})
		),

	saveTheme: (payload: {
		preset?: string;
		mode?: string;
		font?: string;
		radius?: string;
		button?: string;
		card?: string;
		header?: string;
		hero?: string;
		product_layout?: string;
		filter_style?: string;
		primary?: string;
		secondary?: string;
		accent?: string;
		hero_image_url?: string;
	}) =>
		withStorefrontFallback(
			() =>
				api<AdminStorefront>('/api/v1/tenant/customize/theme', {
					method: 'PUT',
					body: JSON.stringify(payload)
				}),
			() =>
				api<AdminStorefront>('/api/v1/tenant/storefront/theme', {
					method: 'PUT',
					body: JSON.stringify(payload)
				})
		),

	saveHomepage: (sections: AdminSection[]) =>
		withStorefrontFallback(
			() =>
				api<AdminStorefront>('/api/v1/tenant/customize/homepage', {
					method: 'PUT',
					body: JSON.stringify({ sections })
				}),
			() =>
				api<AdminStorefront>('/api/v1/tenant/storefront/homepage', {
					method: 'PUT',
					body: JSON.stringify({ sections })
				})
		),

	saveHours: (payload: {
		always_open?: boolean;
		timezone?: string;
		schedule?: Record<string, string[]>;
	}) =>
		withStorefrontFallback(
			() =>
				api<AdminStorefront>('/api/v1/tenant/customize/hours', {
					method: 'PUT',
					body: JSON.stringify(payload)
				}),
			() =>
				api<AdminStorefront>('/api/v1/tenant/storefront/hours', {
					method: 'PUT',
					body: JSON.stringify(payload)
				})
		),

	savePayments: (payload: {
		online_payment_enabled?: boolean;
		cash_enabled?: boolean;
		pay_at_pickup_enabled?: boolean;
		default_payment_method?: string;
	}) =>
		withStorefrontFallback(
			() =>
				api<AdminStorefront>('/api/v1/tenant/customize/payments', {
					method: 'PUT',
					body: JSON.stringify(payload)
				}),
			() =>
				api<AdminStorefront>('/api/v1/tenant/payment-settings', {
					method: 'PUT',
					body: JSON.stringify(payload)
				})
		),

	saveWorkflow: (payload: {
		acceptance_mode?: string;
		payment_requirement?: string;
		ready_notification?: boolean;
		auto_complete?: boolean;
	}) =>
		withStorefrontFallback(
			() =>
				api<AdminStorefront>('/api/v1/tenant/customize/workflow', {
					method: 'PUT',
					body: JSON.stringify(payload)
				}),
			() =>
				api<AdminStorefront>('/api/v1/tenant/order-workflow', {
					method: 'PUT',
					body: JSON.stringify(payload)
				})
		),

	qr: () =>
		withStorefrontFallback(
			() => api<AdminQr>('/api/v1/tenant/customize/qr'),
			() => api<AdminQr>('/api/v1/tenant/storefront/qr')
		),

	/** Live menu categories/products as the storefront will render them. */
	preview: () =>
		withStorefrontFallback(
			() => api<{ categories: unknown[]; products: unknown[] }>('/api/v1/tenant/customize/preview'),
			() => api<{ categories: unknown[]; products: unknown[] }>('/api/v1/tenant/storefront/preview')
		)
};

/** Option lists for the pickers, mirroring the server's enums. */
export const THEME_PRESETS: ThemePreset[] = [
	{
		id: 'classic',
		name: 'Classic',
		blurb: 'Warm red, friendly and familiar',
		primary: '#d7263d',
		secondary: '#8c1c2b',
		accent: '#f2b705',
		font: 'inter',
		radius: 'md',
		button_style: 'rounded',
		card_style: 'elevated',
		header_style: 'sticky',
		hero_style: 'image',
		mode: 'light'
	},
	{
		id: 'modern',
		name: 'Modern',
		blurb: 'Indigo and violet, clean geometry',
		primary: '#5b4bdb',
		secondary: '#8b5cf6',
		accent: '#06b6d4',
		font: 'inter',
		radius: 'lg',
		button_style: 'soft',
		card_style: 'elevated',
		header_style: 'sticky',
		hero_style: 'gradient',
		mode: 'light'
	},
	{
		id: 'street-food',
		name: 'Bold',
		blurb: 'Bold orange, sharp corners',
		primary: '#ea580c',
		secondary: '#b91c1c',
		accent: '#facc15',
		font: 'sora',
		radius: 'sm',
		button_style: 'square',
		card_style: 'outlined',
		header_style: 'solid',
		hero_style: 'image',
		mode: 'light'
	},
	{
		id: 'minimal',
		name: 'Minimal',
		blurb: 'Near-monochrome, quiet and calm',
		primary: '#111827',
		secondary: '#6b7280',
		accent: '#9ca3af',
		font: 'system',
		radius: 'sm',
		button_style: 'square',
		card_style: 'minimal',
		header_style: 'solid',
		hero_style: 'compact',
		mode: 'light'
	},
	{
		id: 'fresh',
		name: 'Fresh',
		blurb: 'Green, light and organic',
		primary: '#059669',
		secondary: '#0d9488',
		accent: '#84cc16',
		font: 'poppins',
		radius: 'lg',
		button_style: 'pill',
		card_style: 'filled',
		header_style: 'sticky',
		hero_style: 'gradient',
		mode: 'light'
	},
	{
		id: 'dark',
		name: 'Dark',
		blurb: 'Charcoal base, neon accents',
		primary: '#f97316',
		secondary: '#fb923c',
		accent: '#22d3ee',
		font: 'sora',
		radius: 'md',
		button_style: 'rounded',
		card_style: 'elevated',
		header_style: 'solid',
		hero_style: 'gradient',
		mode: 'dark'
	}
];

export const FONT_OPTIONS = [
	{ value: 'inter', label: 'Inter' },
	{ value: 'sora', label: 'Sora' },
	{ value: 'poppins', label: 'Poppins' },
	{ value: 'system', label: 'System' }
];

export const RADIUS_OPTIONS = [
	{ value: 'none', label: 'Square' },
	{ value: 'sm', label: 'Subtle' },
	{ value: 'md', label: 'Rounded' },
	{ value: 'lg', label: 'Soft' },
	{ value: 'pill', label: 'Pill' }
];

export const BUTTON_OPTIONS = [
	{ value: 'rounded', label: 'Rounded' },
	{ value: 'pill', label: 'Pill' },
	{ value: 'square', label: 'Square' },
	{ value: 'soft', label: 'Soft' }
];

export const CARD_OPTIONS = [
	{ value: 'elevated', label: 'Elevated' },
	{ value: 'outlined', label: 'Outlined' },
	{ value: 'filled', label: 'Filled' },
	{ value: 'minimal', label: 'Minimal' }
];

export const HEADER_OPTIONS = [
	{ value: 'sticky', label: 'Sticky' },
	{ value: 'solid', label: 'Solid' },
	{ value: 'transparent', label: 'Transparent' }
];

export const HERO_OPTIONS = [
	{ value: 'image', label: 'Photo' },
	{ value: 'gradient', label: 'Gradient' },
	{ value: 'compact', label: 'Compact' },
	{ value: 'none', label: 'None' }
];

export const LAYOUT_OPTIONS = [
	{ value: 'list', label: 'List', hint: 'Horizontal rows — good for long menus' },
	{ value: 'grid', label: 'Grid', hint: 'Photo-forward tiles — good on desktop' },
	{ value: 'compact', label: 'Compact', hint: 'Dense rows for quick scanning' }
];

export const FILTER_OPTIONS = [
	{ value: 'chips', label: 'Chips', hint: 'Rounded pills in a scroll row' },
	{ value: 'pills', label: 'Pills', hint: 'Filled selections with stronger contrast' },
	{ value: 'rail', label: 'Rail', hint: 'Sidebar on desktop, chips on phone' }
];

export const LOGIN_MODE_OPTIONS = [
	{
		value: 'off' as const,
		label: 'Off',
		hint: 'Hide sign-in. Anyone can order as a guest.'
	},
	{
		value: 'optional' as const,
		label: 'Optional',
		hint: 'Customers can sign in for faster checkout and order history.'
	},
	{
		value: 'required' as const,
		label: 'Required',
		hint: 'Customers must sign in with their phone before placing an order.'
	}
];

export const MODE_OPTIONS = [
	{ value: 'light', label: 'Light' },
	{ value: 'dark', label: 'Dark' },
	{ value: 'system', label: 'System' }
];

export const PAYMENT_METHODS = [
	{
		value: 'ONLINE',
		label: 'Online payment',
		hint: 'UPI, card and net banking through a payment gateway'
	},
	{ value: 'CASH', label: 'Cash at pickup', hint: 'The customer pays at the counter' }
];

export const ACCEPTANCE_MODES = [
	{ value: 'AUTO', label: 'Automatic', hint: 'New orders start preparing without a tap' },
	{ value: 'MANUAL', label: 'Manual', hint: 'You accept each order yourself' }
];

export const PAYMENT_TIMINGS = [
	{
		value: 'BEFORE_PREPARATION',
		label: 'Before preparation',
		hint: 'The kitchen only starts once online payment has landed'
	},
	{ value: 'AT_PICKUP', label: 'At pickup', hint: 'The customer pays when they collect' }
];

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const DAY_LABELS: Record<string, string> = {
	mon: 'Monday',
	tue: 'Tuesday',
	wed: 'Wednesday',
	thu: 'Thursday',
	fri: 'Friday',
	sat: 'Saturday',
	sun: 'Sunday'
};

/** `shiftLabel` renders a schedule row for the editor. */
export function shiftLabel(shift: string[] | undefined): string {
	if (!shift || shift.length < 2) return 'Closed';
	return `${shift[0]} – ${shift[1]}`;
}

/** `emptySchedule` is a week with nothing set, which reads as always open. */
export function emptySchedule(): Record<string, string[]> {
	return Object.fromEntries(DAYS.map((day) => [day, []]));
}

/** Fallback document so Customize and Storefront controls always render real UI even if API is offline. */
export function createDefaultStorefront(slug = 'your-shop', name = 'Your Store'): AdminStorefront {
	return {
		store: {
			name,
			slug,
			logo_url: '',
			favicon_url: '',
			tagline: '',
			description: '',
			phone: '',
			address: '',
			business_type: 'RESTAURANT',
			currency: 'INR',
			timezone: 'Asia/Kolkata'
		},
		theme: {
			preset: 'modern',
			mode: 'system',
			font: 'inter',
			radius: 'md',
			button: 'rounded',
			card: 'elevated',
			header: 'sticky',
			hero: 'image',
			product_layout: 'list',
			filter_style: 'chips',
			primary: '#5b4bdb',
			secondary: '#8b5cf6',
			accent: '#06b6d4',
			hero_image_url: '',
			vars: {
				'--sf-primary': '#5b4bdb',
				'--sf-secondary': '#8b5cf6',
				'--sf-accent': '#06b6d4',
				'--sf-font': "'Inter', system-ui, sans-serif"
			}
		},
		behaviour: {
			ordering_enabled: true,
			closed_message: '',
			customer_login_enabled: true,
			customer_login_mode: 'optional',
			prep_time_minutes: 20,
			tax_percent: 0,
			packaging_fee: 0,
			published: true,
			store_status: 'OPEN'
		},
		payments: {
			online_payment_enabled: true,
			cash_enabled: true,
			pay_at_pickup_enabled: true,
			default_payment_method: 'ONLINE',
			methods: ['ONLINE', 'CASH']
		},
		workflow: {
			acceptance_mode: 'MANUAL',
			payment_requirement: 'BEFORE_PREPARATION',
			ready_notification: true,
			auto_complete: false
		},
		hours: {
			always_open: true,
			timezone: 'Asia/Kolkata',
			schedule: {},
			days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
			is_open: true,
			label: 'Open',
			detail: 'Open 24 hours',
			today_closes: '24 hours'
		},
		homepage: {
			sections: [
				{ id: 'hero', type: 'HERO', enabled: true, content: {} },
				{ id: 'categories', type: 'CATEGORIES', enabled: true, content: { title: 'Browse by category' } },
				{ id: 'popular', type: 'POPULAR_PRODUCTS', enabled: true, content: { title: 'Popular right now' } },
				{ id: 'featured', type: 'FEATURED_PRODUCTS', enabled: true, content: { title: "Chef's picks" } },
				{ id: 'menu', type: 'MENU', enabled: true, content: { title: 'Full menu' } },
				{ id: 'business', type: 'BUSINESS_INFO', enabled: true, content: {} },
				{ id: 'hours', type: 'OPENING_HOURS', enabled: true, content: {} },
				{ id: 'footer', type: 'FOOTER', enabled: true, content: {} }
			]
		},
		catalogues: {
			presets: THEME_PRESETS,
			section_types: [
				{ type: 'HERO', label: 'Hero banner', blurb: 'Store photo and headline', fields: [] },
				{ type: 'CATEGORIES', label: 'Categories', blurb: 'Category filter strip', fields: [] },
				{ type: 'POPULAR_PRODUCTS', label: 'Popular items', blurb: 'Bestseller carousel', fields: [] },
				{ type: 'FEATURED_PRODUCTS', label: 'Featured', blurb: 'Chef picks highlight', fields: [] },
				{ type: 'MENU', label: 'Full menu', blurb: 'Complete menu listing', fields: [] },
				{ type: 'BUSINESS_INFO', label: 'Business info', blurb: 'Address and phone', fields: [] },
				{ type: 'OPENING_HOURS', label: 'Hours', blurb: 'Weekly schedule', fields: [] },
				{ type: 'FOOTER', label: 'Footer', blurb: 'Copyright and footer links', fields: [] },
				{ type: 'ANNOUNCEMENT', label: 'Announcement', blurb: 'Top promotional banner', fields: [] }
			],
			days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
		},
		ordering_available_now: true,
		closed_reason: '',
		public_url: '',
		updated_at: new Date().toISOString()
	};
}

/** True when the document is the offline placeholder (`createDefaultStorefront`), not API data. */
export function isDefaultStorefront(config: AdminStorefront | null | undefined): boolean {
	if (!config) return true;
	return config.store.slug === 'your-shop' && config.public_url === '';
}
