/**
 * Tenant admin storefront configuration — types and API.
 *
 * The admin screens are deliberately thin. Every value here is validated by the
 * server against a closed catalogue, and a rejected value comes back as a
 * specific error the form can show next to the field that caused it. The client
 * mirrors the enums only so the pickers can render — it is not the authority.
 */

import { api } from '$lib/api/client';
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

export const storefrontAdminApi = {
	get: () => api<AdminStorefront>('/api/v1/tenant/storefront'),

	saveIdentity: (payload: {
		name?: string;
		logo_url?: string;
		favicon_url?: string;
		tagline?: string;
		description?: string;
		phone?: string;
		address?: string;
	}) => api<AdminStorefront>('/api/v1/tenant/storefront', { method: 'PUT', body: JSON.stringify(payload) }),

	saveBehaviour: (payload: {
		ordering_enabled?: boolean;
		closed_message?: string;
		customer_login_enabled?: boolean;
		prep_time_minutes?: number;
		tax_percent?: number | string;
		packaging_fee?: number | string;
		published?: boolean;
	}) => api<AdminStorefront>('/api/v1/tenant/storefront', { method: 'PUT', body: JSON.stringify(payload) }),

	saveTheme: (payload: {
		preset?: string;
		mode?: string;
		font?: string;
		radius?: string;
		button?: string;
		card?: string;
		header?: string;
		hero?: string;
		primary?: string;
		secondary?: string;
		accent?: string;
		hero_image_url?: string;
	}) =>
		api<AdminStorefront>('/api/v1/tenant/storefront/theme', {
			method: 'PUT',
			body: JSON.stringify(payload)
		}),

	saveHomepage: (sections: AdminSection[]) =>
		api<AdminStorefront>('/api/v1/tenant/storefront/homepage', {
			method: 'PUT',
			body: JSON.stringify({ sections })
		}),

	saveHours: (payload: {
		always_open?: boolean;
		timezone?: string;
		schedule?: Record<string, string[]>;
	}) =>
		api<AdminStorefront>('/api/v1/tenant/storefront/hours', {
			method: 'PUT',
			body: JSON.stringify(payload)
		}),

	savePayments: (payload: {
		online_payment_enabled?: boolean;
		cash_enabled?: boolean;
		pay_at_pickup_enabled?: boolean;
		default_payment_method?: string;
	}) =>
		api<AdminStorefront>('/api/v1/tenant/payment-settings', {
			method: 'PUT',
			body: JSON.stringify(payload)
		}),

	saveWorkflow: (payload: {
		acceptance_mode?: string;
		payment_requirement?: string;
		ready_notification?: boolean;
		auto_complete?: boolean;
	}) =>
		api<AdminStorefront>('/api/v1/tenant/order-workflow', {
			method: 'PUT',
			body: JSON.stringify(payload)
		}),

	qr: () => api<AdminQr>('/api/v1/tenant/storefront/qr'),

	/** The storefront as the customer will see it right now. */
	preview: () => api<{ config: StoreConfig; menu: import('./api').StoreMenu | null }>('/api/v1/tenant/storefront/preview-view')
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
		name: 'Street Food',
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
