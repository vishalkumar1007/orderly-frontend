const KEY = 'orderly-onboard-draft';

export type OnboardDraft = {
	org: {
		name: string;
		business_type: string;
		slug: string;
		logo_url: string;
		phone: string;
		email: string;
		address: string;
	};
	admin: { admin_name: string; admin_email: string; admin_phone: string };
	plan: string;
	brand: {
		preset_id: string;
		color_mode: 'light' | 'dark' | 'system';
		primary: string;
		secondary: string;
		logo_url: string;
		favicon_url: string;
	};
	store: {
		store_name: string;
		short_description: string;
		currency: string;
		timezone: string;
		language: string;
		store_status: 'OPEN' | 'CLOSED';
	};
	step: number;
};

export function defaultDraft(): OnboardDraft {
	return {
		org: { name: '', business_type: '', slug: '', logo_url: '', phone: '', email: '', address: '' },
		admin: { admin_name: '', admin_email: '', admin_phone: '' },
		plan: '',
		brand: {
			preset_id: 'indigo-violet',
			color_mode: 'system',
			primary: '',
			secondary: '',
			logo_url: '',
			favicon_url: ''
		},
		store: {
			store_name: '',
			short_description: '',
			currency: 'INR',
			timezone: 'Asia/Kolkata',
			language: 'en',
			store_status: 'OPEN'
		},
		step: 0
	};
}

export function loadOnboardDraft(): OnboardDraft | null {
	if (typeof sessionStorage === 'undefined') return null;
	try {
		const raw = sessionStorage.getItem(KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<OnboardDraft>;
		const base = defaultDraft();
		return {
			...base,
			...parsed,
			org: { ...base.org, ...parsed.org },
			admin: { ...base.admin, ...parsed.admin },
			brand: { ...base.brand, ...parsed.brand },
			store: { ...base.store, ...parsed.store }
		};
	} catch {
		return null;
	}
}

export function saveOnboardDraft(draft: OnboardDraft) {
	if (typeof sessionStorage === 'undefined') return;
	sessionStorage.setItem(KEY, JSON.stringify(draft));
}

export function clearOnboardDraft() {
	if (typeof sessionStorage === 'undefined') return;
	sessionStorage.removeItem(KEY);
}

const SUCCESS_KEY = 'orderly-onboard-success';

export function saveOnboardSuccess(payload: unknown) {
	if (typeof sessionStorage === 'undefined') return;
	sessionStorage.setItem(SUCCESS_KEY, JSON.stringify(payload));
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
