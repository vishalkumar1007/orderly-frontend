import { storefrontAdminApi, type AdminStorefront, type AdminSection } from './admin';
import { computeClientThemeVars } from './theme';
import { setStorefrontAdmin } from './adminCache.svelte';

export type DiffItem = {
	category: string;
	label: string;
	from: string;
	to: string;
};

/** Deep clone a storefront config */
export function cloneConfig(cfg: AdminStorefront): AdminStorefront {
	const cloned: AdminStorefront = JSON.parse(JSON.stringify(cfg));
	if (cloned.theme) {
		cloned.theme.vars = computeClientThemeVars(cloned.theme);
	}
	return cloned;
}

/** Compute human-readable differences between draft and published */
export function computeConfigDiff(draft: AdminStorefront, published: AdminStorefront): DiffItem[] {
	const diffs: DiffItem[] = [];

	// Style / Theme
	if (draft.theme.preset !== published.theme.preset) {
		diffs.push({
			category: 'Style',
			label: 'Theme Preset',
			from: published.theme.preset,
			to: draft.theme.preset
		});
	}
	if (draft.theme.font !== published.theme.font) {
		diffs.push({
			category: 'Style',
			label: 'Typography',
			from: published.theme.font,
			to: draft.theme.font
		});
	}
	if (draft.theme.button !== published.theme.button) {
		diffs.push({
			category: 'Style',
			label: 'Button Style',
			from: published.theme.button,
			to: draft.theme.button
		});
	}
	if (draft.theme.radius !== published.theme.radius) {
		diffs.push({
			category: 'Style',
			label: 'Border Radius',
			from: published.theme.radius,
			to: draft.theme.radius
		});
	}
	if (draft.theme.card !== published.theme.card) {
		diffs.push({
			category: 'Style',
			label: 'Product Card Style',
			from: published.theme.card,
			to: draft.theme.card
		});
	}
	if (draft.theme.product_layout !== published.theme.product_layout) {
		diffs.push({
			category: 'Style',
			label: 'Menu Layout',
			from: published.theme.product_layout,
			to: draft.theme.product_layout
		});
	}

	// Branding
	if (draft.store.name !== published.store.name) {
		diffs.push({
			category: 'Branding',
			label: 'Business Name',
			from: published.store.name,
			to: draft.store.name
		});
	}
	if (draft.store.tagline !== published.store.tagline) {
		diffs.push({
			category: 'Branding',
			label: 'Tagline',
			from: published.store.tagline || '(none)',
			to: draft.store.tagline || '(none)'
		});
	}
	if (draft.store.logo_url !== published.store.logo_url) {
		diffs.push({
			category: 'Branding',
			label: 'Logo URL',
			from: published.store.logo_url ? 'Configured' : '(none)',
			to: draft.store.logo_url ? 'Configured' : '(none)'
		});
	}
	if (draft.theme.primary !== published.theme.primary) {
		diffs.push({
			category: 'Branding',
			label: 'Primary Color',
			from: published.theme.primary,
			to: draft.theme.primary
		});
	}
	if (draft.theme.secondary !== published.theme.secondary) {
		diffs.push({
			category: 'Branding',
			label: 'Secondary Color',
			from: published.theme.secondary,
			to: draft.theme.secondary
		});
	}
	if (draft.theme.accent !== published.theme.accent) {
		diffs.push({
			category: 'Branding',
			label: 'Accent Color',
			from: published.theme.accent,
			to: draft.theme.accent
		});
	}
	if (draft.theme.mode !== published.theme.mode) {
		diffs.push({
			category: 'Branding',
			label: 'Theme Mode',
			from: published.theme.mode,
			to: draft.theme.mode
		});
	}
	if (draft.store.business_type !== published.store.business_type) {
		diffs.push({
			category: 'Branding',
			label: 'Business Type',
			from: published.store.business_type || 'RESTAURANT',
			to: draft.store.business_type
		});
	}

	// Menu Appearance
	if (draft.theme.filter_style !== published.theme.filter_style) {
		diffs.push({
			category: 'Menu Appearance',
			label: 'Category Style',
			from: published.theme.filter_style,
			to: draft.theme.filter_style
		});
	}
	if (draft.theme.header !== published.theme.header) {
		diffs.push({
			category: 'Menu Appearance',
			label: 'Header Behavior',
			from: published.theme.header,
			to: draft.theme.header
		});
	}

	// Customer Experience
	if (draft.behaviour.customer_login_mode !== published.behaviour.customer_login_mode) {
		diffs.push({
			category: 'Customer Experience',
			label: 'Customer Phone Login',
			from: published.behaviour.customer_login_mode,
			to: draft.behaviour.customer_login_mode
		});
	}
	if (draft.behaviour.ordering_enabled !== published.behaviour.ordering_enabled) {
		diffs.push({
			category: 'Customer Experience',
			label: 'Ordering Enabled',
			from: published.behaviour.ordering_enabled ? 'ON' : 'OFF',
			to: draft.behaviour.ordering_enabled ? 'ON' : 'OFF'
		});
	}

	// Checkout
	if (draft.payments.online_payment_enabled !== published.payments.online_payment_enabled) {
		diffs.push({
			category: 'Checkout',
			label: 'Online Payment',
			from: published.payments.online_payment_enabled ? 'Enabled' : 'Disabled',
			to: draft.payments.online_payment_enabled ? 'Enabled' : 'Disabled'
		});
	}
	if (draft.payments.cash_enabled !== published.payments.cash_enabled) {
		diffs.push({
			category: 'Checkout',
			label: 'Cash at Counter',
			from: published.payments.cash_enabled ? 'Enabled' : 'Disabled',
			to: draft.payments.cash_enabled ? 'Enabled' : 'Disabled'
		});
	}
	if (draft.payments.pay_at_pickup_enabled !== published.payments.pay_at_pickup_enabled) {
		diffs.push({
			category: 'Checkout',
			label: 'Pay at Pickup',
			from: published.payments.pay_at_pickup_enabled ? 'Enabled' : 'Disabled',
			to: draft.payments.pay_at_pickup_enabled ? 'Enabled' : 'Disabled'
		});
	}
	if (draft.workflow.acceptance_mode !== published.workflow.acceptance_mode) {
		diffs.push({
			category: 'Checkout',
			label: 'Order Acceptance Mode',
			from: published.workflow.acceptance_mode,
			to: draft.workflow.acceptance_mode
		});
	}
	if (draft.workflow.payment_requirement !== published.workflow.payment_requirement) {
		diffs.push({
			category: 'Checkout',
			label: 'Payment Requirement',
			from: published.workflow.payment_requirement,
			to: draft.workflow.payment_requirement
		});
	}

	// Homepage sections
	const dSecs = draft.homepage?.sections ?? [];
	const pSecs = published.homepage?.sections ?? [];
	if (JSON.stringify(dSecs) !== JSON.stringify(pSecs)) {
		diffs.push({
			category: 'Homepage',
			label: 'Homepage Sections',
			from: `${pSecs.filter((s) => s.enabled).length} enabled`,
			to: `${dSecs.filter((s) => s.enabled).length} enabled`
		});
	}

	return diffs;
}

/** Reactive Draft Store Class */
export class StudioDraftStore {
	draft = $state<AdminStorefront>(null!);
	published = $state<AdminStorefront>(null!);
	history = $state<AdminStorefront[]>([]);
	lastSavedTimestamp = $state<string>('');
	isSaving = $state<boolean>(false);
	isPublishing = $state<boolean>(false);
	error = $state<string>('');

	constructor(initial: AdminStorefront) {
		this.init(initial);
	}

	init(base: AdminStorefront) {
		const clean = cloneConfig(base);
		this.published = clean;

		// Check local storage for existing draft
		const slug = clean.store.slug || 'your-shop';
		const storageKey = `orderly_studio_draft_${slug}`;
		let loadedFromStorage = false;

		if (typeof window !== 'undefined') {
			try {
				const saved = localStorage.getItem(storageKey);
				if (saved) {
					const parsed = JSON.parse(saved);
					if (parsed && parsed.theme && parsed.store) {
						this.draft = cloneConfig(parsed);
						this.lastSavedTimestamp = 'Restored unsaved draft';
						loadedFromStorage = true;
					}
				}
			} catch {
				// ignore parse errors
			}
		}

		if (!loadedFromStorage) {
			this.draft = cloneConfig(base);
		}

		this.history = [];
	}

	/** Record change and append to undo stack */
	mutate(updater: (draft: AdminStorefront) => void) {
		// push current to history before modifying
		if (this.history.length >= 25) {
			this.history.shift();
		}
		this.history.push(cloneConfig(this.draft));

		updater(this.draft);

		// ensure CSS custom vars are always up-to-date
		this.draft.theme.vars = computeClientThemeVars(this.draft.theme);

		// auto-persist to storage
		this.persistToStorage();
	}

	persistToStorage() {
		if (typeof window === 'undefined' || !this.draft) return;
		try {
			const slug = this.draft.store.slug || 'your-shop';
			localStorage.setItem(`orderly_studio_draft_${slug}`, JSON.stringify(this.draft));
			const now = new Date();
			this.lastSavedTimestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		} catch {
			// ignore storage errors
		}
	}

	undo(): boolean {
		if (this.history.length === 0) return false;
		const prev = this.history.pop();
		if (prev) {
			this.draft = cloneConfig(prev);
			this.persistToStorage();
			return true;
		}
		return false;
	}

	revertAll() {
		this.draft = cloneConfig(this.published);
		this.history = [];
		if (typeof window !== 'undefined') {
			const slug = this.draft.store.slug || 'your-shop';
			localStorage.removeItem(`orderly_studio_draft_${slug}`);
		}
		this.lastSavedTimestamp = '';
	}

	get diffs(): DiffItem[] {
		if (!this.draft || !this.published) return [];
		return computeConfigDiff(this.draft, this.published);
	}

	get isDirty(): boolean {
		return this.diffs.length > 0;
	}

	async publish(): Promise<boolean> {
		if (!this.draft) return false;
		this.isPublishing = true;
		this.error = '';

		try {
			const d = this.draft;

			// 1. Identity & Branding
			await storefrontAdminApi.saveIdentity({
				name: d.store.name,
				logo_url: d.store.logo_url,
				favicon_url: d.store.favicon_url,
				tagline: d.store.tagline,
				description: d.store.description,
				phone: d.store.phone,
				address: d.store.address
			});

			// 2. Theme tokens
			await storefrontAdminApi.saveTheme({
				preset: d.theme.preset,
				mode: d.theme.mode,
				font: d.theme.font,
				radius: d.theme.radius,
				button: d.theme.button,
				card: d.theme.card,
				header: d.theme.header,
				hero: d.theme.hero,
				product_layout: d.theme.product_layout,
				filter_style: d.theme.filter_style,
				primary: d.theme.primary,
				secondary: d.theme.secondary,
				accent: d.theme.accent,
				hero_image_url: d.theme.hero_image_url
			});

			// 3. Homepage sections
			if (d.homepage?.sections) {
				await storefrontAdminApi.saveHomepage(d.homepage.sections);
			}

			// 4. Payments
			await storefrontAdminApi.savePayments({
				online_payment_enabled: d.payments.online_payment_enabled,
				cash_enabled: d.payments.cash_enabled,
				pay_at_pickup_enabled: d.payments.pay_at_pickup_enabled,
				default_payment_method: d.payments.default_payment_method
			});

			// 5. Workflow
			await storefrontAdminApi.saveWorkflow({
				acceptance_mode: d.workflow.acceptance_mode,
				payment_requirement: d.workflow.payment_requirement,
				ready_notification: d.workflow.ready_notification,
				auto_complete: d.workflow.auto_complete
			});

			// 6. Behaviour & Customer login
			const updated = await storefrontAdminApi.saveBehaviour({
				ordering_enabled: d.behaviour.ordering_enabled,
				customer_login_mode: d.behaviour.customer_login_mode,
				prep_time_minutes: d.behaviour.prep_time_minutes,
				tax_percent: d.behaviour.tax_percent,
				packaging_fee: d.behaviour.packaging_fee,
				published: d.behaviour.published,
				store_status: d.behaviour.store_status
			});

			// Update baseline to match new published state
			this.published = cloneConfig(updated);
			this.draft = cloneConfig(updated);
			this.history = [];
			setStorefrontAdmin(updated);

			// Clear local storage draft
			if (typeof window !== 'undefined') {
				const slug = updated.store.slug || 'your-shop';
				localStorage.removeItem(`orderly_studio_draft_${slug}`);
			}

			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Could not publish changes';
			return false;
		} finally {
			this.isPublishing = false;
		}
	}
}
