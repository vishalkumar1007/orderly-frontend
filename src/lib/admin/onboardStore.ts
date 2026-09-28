import type { BusinessTypeTemplate } from './businessTypes';

/**
 * The onboarding draft.
 *
 * Onboarding is eight steps long and asks for things an operator often has to
 * go and look up — the owner's email, the exact business name. Losing that to
 * an accidental refresh is the kind of small cruelty that makes people dread a
 * tool, so the draft is mirrored into sessionStorage on every change and
 * restored on the way back in. It is cleared the moment the business exists.
 *
 * sessionStorage, not localStorage: a half-finished business is scoped to the
 * tab you were doing it in, and should not reappear tomorrow.
 */

const KEY = 'orderly-onboard-draft';

export type OnboardConfig = {
	ordering_enabled: boolean;
	customer_login_mode: 'off' | 'optional' | 'required';
	prep_time_minutes: number;
	acceptance_mode: 'MANUAL' | 'AUTO';
	payment_requirement: 'BEFORE_PREPARATION' | 'AT_PICKUP';
	ready_notification: boolean;
	auto_complete: boolean;
	online_payment_enabled: boolean;
	cash_enabled: boolean;
	default_payment_method: 'ONLINE' | 'CASH';
};

export type OnboardDraft = {
	/** The business-type code chosen in step 1. Drives every default below. */
	type: string;
	org: {
		name: string;
		slug: string;
		phone: string;
		email: string;
		address: string;
		short_description: string;
		currency: string;
		timezone: string;
		language: string;
	};
	admin: {
		owner_name: string;
		admin_name: string;
		admin_email: string;
		admin_phone: string;
	};
	plan: string;
	/**
	 * The storefront theme, in the same shape the business's own Customize
	 * screen uses. Onboarding and that screen share one picker, so an operator
	 * chooses from exactly what the owner will later see.
	 */
	theme: {
		preset: string;
		mode: string;
		primary: string;
		secondary: string;
		accent: string;
		font: string;
		radius: string;
		button: string;
		card: string;
		hero: string;
		product_layout: string;
		filter_style: string;
		logo_url: string;
		favicon_url: string;
	};
	config: OnboardConfig;
	step: number;
};

export function defaultDraft(): OnboardDraft {
	return {
		type: '',
		org: {
			name: '',
			slug: '',
			phone: '',
			email: '',
			address: '',
			short_description: '',
			currency: 'INR',
			timezone: 'Asia/Kolkata',
			language: 'en'
		},
		admin: { owner_name: '', admin_name: '', admin_email: '', admin_phone: '' },
		plan: '',
		theme: {
			preset: 'modern',
			mode: 'light',
			primary: '#5b4bdb',
			secondary: '#8b5cf6',
			accent: '#06b6d4',
			font: 'inter',
			radius: 'lg',
			button: 'soft',
			card: 'elevated',
			hero: 'gradient',
			product_layout: 'grid',
			filter_style: 'chips',
			logo_url: '',
			favicon_url: ''
		},
		config: {
			ordering_enabled: true,
			customer_login_mode: 'optional',
			prep_time_minutes: 20,
			acceptance_mode: 'MANUAL',
			payment_requirement: 'BEFORE_PREPARATION',
			ready_notification: true,
			auto_complete: false,
			online_payment_enabled: true,
			cash_enabled: true,
			default_payment_method: 'ONLINE'
		},
		step: 0
	};
}

/**
 * The configuration a business type starts from.
 *
 * Called when the type is chosen, so step 6 opens on that type's defaults
 * rather than on the previous type's. Anything the operator then changes is
 * their decision and survives until the type changes again.
 */
export function configFromTemplate(template: BusinessTypeTemplate): OnboardConfig {
	return {
		ordering_enabled: template.behaviour.ordering_enabled,
		customer_login_mode: template.behaviour.customer_login_mode,
		prep_time_minutes: template.behaviour.prep_time_minutes,
		acceptance_mode: template.workflow.acceptance_mode,
		payment_requirement: template.workflow.payment_requirement,
		ready_notification: template.workflow.ready_notification,
		auto_complete: template.workflow.auto_complete,
		online_payment_enabled: template.payments.online_payment_enabled,
		cash_enabled: template.payments.cash_enabled,
		default_payment_method: template.payments.default_payment_method
	};
}

/**
 * The storefront theme a business type starts from.
 *
 * The type's template names a storefront preset; its colours and details come
 * from that preset, so the starting point is a complete, coherent look rather
 * than a colour bolted onto defaults.
 */
export function themeFromTemplate(
	template: BusinessTypeTemplate,
	presets: { id: string; primary: string; secondary: string; accent: string; font: string; radius: string; button_style: string; card_style: string; hero_style: string; mode: string }[]
): OnboardDraft['theme'] {
	const preset =
		presets.find((p) => p.id === template.storefront.theme_preset) ?? presets[0];
	const base = defaultDraft().theme;
	if (!preset) return { ...base, product_layout: template.storefront.product_layout };
	return {
		preset: preset.id,
		mode: preset.mode,
		primary: preset.primary,
		secondary: preset.secondary,
		accent: preset.accent,
		font: preset.font,
		radius: preset.radius,
		button: preset.button_style,
		card: preset.card_style,
		hero: template.storefront.hero_style || preset.hero_style,
		product_layout: template.storefront.product_layout,
		filter_style: base.filter_style,
		logo_url: '',
		favicon_url: ''
	};
}

export function loadOnboardDraft(): OnboardDraft | null {
	if (typeof sessionStorage === 'undefined') return null;
	try {
		const raw = sessionStorage.getItem(KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<OnboardDraft>;
		const base = defaultDraft();
		// Merged field by field: a draft saved before a field existed must not
		// come back with that field undefined and break the form that binds it.
		return {
			...base,
			...parsed,
			org: { ...base.org, ...parsed.org },
			admin: { ...base.admin, ...parsed.admin },
			theme: { ...base.theme, ...parsed.theme },
			config: { ...base.config, ...parsed.config }
		};
	} catch {
		return null;
	}
}

export function saveOnboardDraft(draft: OnboardDraft) {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.setItem(KEY, JSON.stringify(draft));
	} catch {
		/* private mode — the draft simply will not survive a refresh */
	}
}

export function clearOnboardDraft() {
	if (typeof sessionStorage === 'undefined') return;
	sessionStorage.removeItem(KEY);
}

const SUCCESS_KEY = 'orderly-onboard-success';

/**
 * The result of the last successful creation.
 *
 * Kept because the success screen carries the one-time setup link. Losing it to
 * a refresh means regenerating the invite, so it survives until the operator
 * moves on.
 */
export function saveOnboardSuccess(payload: unknown) {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.setItem(SUCCESS_KEY, JSON.stringify(payload));
	} catch {
		/* the link is still on screen; only the refresh copy is lost */
	}
}

export function loadOnboardSuccess<T>(): T | null {
	if (typeof sessionStorage === 'undefined') return null;
	try {
		const raw = sessionStorage.getItem(SUCCESS_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

export function clearOnboardSuccess() {
	if (typeof sessionStorage === 'undefined') return;
	sessionStorage.removeItem(SUCCESS_KEY);
}
