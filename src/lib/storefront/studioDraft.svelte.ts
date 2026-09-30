import { ApiClientError, api } from '$lib/api/client';
import { setStorefrontAdmin } from './adminCache.svelte';
import { computeClientThemeVars } from './theme';
import { mergeAdminDraft, storefrontAdminApi, type AdminStorefront } from './admin';
import { patchDashboardStoreStatus } from '$lib/tenant/dashboardCache.svelte';

/**
 * The Studio's working copy.
 *
 * A draft belongs to the shop, not to the browser it was typed in. It is stored
 * server-side (`/api/v1/tenant/customize/draft`), so it opens on any device the
 * owner signs in on and survives a crash, and publishing it is a single
 * transaction rather than a run of writes that can stop halfway.
 *
 * Three things this replaces, all of which were quiet rather than loud:
 *
 *  - "Autosaved" meant localStorage. Switching device lost the work.
 *  - Publishing replayed the whole local document over the live shop, so a
 *    draft left open overwrote whatever a colleague had changed in between.
 *  - The change list was hand-written and covered about half the fields it
 *    published, so editing prep time, tax, the packaging fee, an address or a
 *    hero image left the header saying "Published Live" over unsaved work.
 *
 * The third is why the field map below is the only description of what a change
 * is: `diffs`, `isDirty` and the review screen all read it, so a field cannot be
 * publishable and invisible at the same time.
 */

export type DiffItem = {
	category: string;
	label: string;
	from: string;
	to: string;
};

/** How a value is shown in the change list. */
type Fmt = (v: unknown) => string;

const asText: Fmt = (v) => (v === '' || v == null ? '(none)' : String(v));
const asOnOff: Fmt = (v) => (v ? 'On' : 'Off');
const asPresence: Fmt = (v) => (v ? 'Set' : '(none)');
const asMoney: Fmt = (v) => (v == null || v === '' ? '0' : String(v));

type FieldSpec = {
	category: string;
	label: string;
	/** Path into the storefront document, e.g. `theme.preset`. */
	path: string;
	format?: Fmt;
};

/**
 * Every field the Studio can change, in the order the review screen lists them.
 *
 * Adding a control means adding a line here. Leaving it out is what made the
 * old screen lie, so this list — not the publish call — is the definition of
 * what counts as an unpublished change.
 */
const FIELDS: FieldSpec[] = [
	// Brand identity
	{ category: 'Brand', label: 'Business name', path: 'store.name' },
	{ category: 'Brand', label: 'Tagline', path: 'store.tagline' },
	{ category: 'Brand', label: 'Description', path: 'store.description' },
	{ category: 'Brand', label: 'Logo', path: 'store.logo_url', format: asPresence },
	{ category: 'Brand', label: 'Favicon', path: 'store.favicon_url', format: asPresence },

	// Contact
	{ category: 'Contact', label: 'Phone', path: 'store.phone' },
	{ category: 'Contact', label: 'Address', path: 'store.address' },

	// Look
	{ category: 'Look', label: 'Theme preset', path: 'theme.preset' },
	{ category: 'Look', label: 'Default theme', path: 'theme.mode' },
	{
		category: 'Look',
		label: 'Customer theme switch',
		path: 'theme.customer_mode_switch_enabled',
		format: asOnOff
	},
	{ category: 'Look', label: 'Primary colour', path: 'theme.primary' },
	{ category: 'Look', label: 'Secondary colour', path: 'theme.secondary' },
	{ category: 'Look', label: 'Accent colour', path: 'theme.accent' },
	{ category: 'Look', label: 'Typeface', path: 'theme.font' },
	{ category: 'Look', label: 'Corner style', path: 'theme.radius' },
	{ category: 'Look', label: 'Button style', path: 'theme.button' },
	{ category: 'Look', label: 'Card style', path: 'theme.card' },
	{ category: 'Look', label: 'Hero style', path: 'theme.hero' },
	{ category: 'Look', label: 'Hero image', path: 'theme.hero_image_url', format: asPresence },
	{ category: 'Menu layout', label: 'Catalogue layout', path: 'theme.product_layout' },
	{ category: 'Menu layout', label: 'Filter style', path: 'theme.filter_style' },
	{ category: 'Menu layout', label: 'Header style', path: 'theme.header' },

	// Ordering — store_status / status_message / hours are live ops (Action +
	// Customize share the same APIs); they are never draft diffs.
	{ category: 'Ordering', label: 'Accepting orders', path: 'behaviour.ordering_enabled', format: asOnOff },
	{ category: 'Ordering', label: 'Closed message', path: 'behaviour.closed_message' },
	{ category: 'Customers', label: 'Phone sign-in', path: 'behaviour.customer_login_mode' },
	{ category: 'Ordering', label: 'Preparation time', path: 'behaviour.prep_time_minutes' },
	{ category: 'Ordering', label: 'Tax', path: 'behaviour.tax_percent', format: asMoney },
	{ category: 'Ordering', label: 'Packaging fee', path: 'behaviour.packaging_fee', format: asMoney },
	{ category: 'Ordering', label: 'Published', path: 'behaviour.published', format: asOnOff },

	// Payments
	{ category: 'Payments', label: 'Online payment', path: 'payments.online_payment_enabled', format: asOnOff },
	{ category: 'Payments', label: 'Cash', path: 'payments.cash_enabled', format: asOnOff },
	{ category: 'Payments', label: 'Pay at pickup', path: 'payments.pay_at_pickup_enabled', format: asOnOff },
	{ category: 'Payments', label: 'Default method', path: 'payments.default_payment_method' },

	// Workflow
	{ category: 'Workflow', label: 'Order acceptance', path: 'workflow.acceptance_mode' },
	{ category: 'Workflow', label: 'Payment timing', path: 'workflow.payment_requirement' },
	{ category: 'Workflow', label: 'Ready notification', path: 'workflow.ready_notification', format: asOnOff },
	{ category: 'Workflow', label: 'Auto-complete', path: 'workflow.auto_complete', format: asOnOff }
];

function at(obj: unknown, path: string): unknown {
	return path.split('.').reduce<unknown>((acc, key) => {
		if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
		return undefined;
	}, obj);
}

/** Deep clone, with the CSS custom properties recomputed for the preview. */
export function cloneConfig(cfg: AdminStorefront): AdminStorefront {
	const cloned: AdminStorefront = JSON.parse(JSON.stringify(cfg));
	if (cloned.theme) cloned.theme.vars = computeClientThemeVars(cloned.theme);
	return cloned;
}

/** What has changed between the draft and what customers see today. */
export function computeConfigDiff(
	draft: AdminStorefront,
	published: AdminStorefront
): DiffItem[] {
	const diffs: DiffItem[] = [];
	for (const field of FIELDS) {
		const to = at(draft, field.path);
		const from = at(published, field.path);
		// Loose compare: the API returns numbers the form holds as strings, and
		// "20" is not a change from 20.
		if (String(to ?? '') === String(from ?? '')) continue;
		const fmt = field.format ?? asText;
		diffs.push({ category: field.category, label: field.label, from: fmt(from), to: fmt(to) });
	}

	// The homepage is a list, so it is compared as one rather than field by
	// field: the useful statement is "the homepage changed", not eleven rows.
	const a = JSON.stringify(draft.homepage?.sections ?? []);
	const b = JSON.stringify(published.homepage?.sections ?? []);
	if (a !== b) {
		const on = (cfg: AdminStorefront) =>
			(cfg.homepage?.sections ?? []).filter((s) => s.enabled).length;
		diffs.push({
			category: 'Homepage',
			label: 'Sections',
			from: `${on(published)} shown`,
			to: `${on(draft)} shown`
		});
	}

	return diffs;
}

function copyLiveOps(target: AdminStorefront, live: AdminStorefront) {
	target.behaviour.store_status = live.behaviour.store_status;
	target.behaviour.status_message = live.behaviour.status_message;
	target.behaviour.store_status_label = live.behaviour.store_status_label;
	target.behaviour.status_message_display = live.behaviour.status_message_display;
	target.hours = {
		...target.hours,
		always_open: live.hours.always_open,
		timezone: live.hours.timezone,
		schedule: live.hours.schedule,
		is_open: live.hours.is_open,
		label: live.hours.label,
		detail: live.hours.detail
	};
	target.ordering_available_now = live.ordering_available_now;
	target.closed_reason = live.closed_reason;
}

function liveOpsEqual(a: AdminStorefront, b: AdminStorefront): boolean {
	if (String(a.behaviour.store_status ?? '') !== String(b.behaviour.store_status ?? '')) return false;
	if (String(a.behaviour.status_message ?? '') !== String(b.behaviour.status_message ?? '')) return false;
	return (
		JSON.stringify({
			always_open: a.hours?.always_open,
			timezone: a.hours?.timezone,
			schedule: a.hours?.schedule
		}) ===
		JSON.stringify({
			always_open: b.hours?.always_open,
			timezone: b.hours?.timezone,
			schedule: b.hours?.schedule
		})
	);
}

type DraftEnvelope = {
	draft: AdminStorefront | null;
	base_version?: string;
	updated_at?: string;
	updated_by?: string;
	live_version?: string;
	stale?: boolean;
};

const AUTOSAVE_DELAY_MS = 900;

export class StudioDraftStore {
	draft = $state<AdminStorefront>(null!);
	published = $state<AdminStorefront>(null!);
	history = $state<AdminStorefront[]>([]);

	/** Server-reported save state, never a guess. */
	savedAt = $state<string>('');
	savedBy = $state<string>('');
	isSaving = $state(false);
	isPublishing = $state(false);
	isLoading = $state(true);
	/** The live shop moved on after this draft was started. */
	isStale = $state(false);
	error = $state('');

	#timer: ReturnType<typeof setTimeout> | null = null;
	#pending = false;

	constructor(initial: AdminStorefront) {
		this.published = cloneConfig(initial);
		this.draft = cloneConfig(initial);
	}

	/**
	 * Adopt the live config and pick up any draft stored for this shop.
	 *
	 * Called whenever the shell's config arrives or changes. A draft found on
	 * the server wins over the live values — that is the point of it — but the
	 * baseline it is compared against is always the live shop.
	 */
	async load(live: AdminStorefront): Promise<void> {
		this.published = cloneConfig(live);
		this.isLoading = true;
		try {
			const env = await api<DraftEnvelope>('/api/v1/tenant/customize/draft');
			if (env.draft) {
				// A stored draft is a partial document: merge it over the live
				// config so a field nobody touched keeps its published value.
				// Live ops (status, banner, hours) always come from the live shop
				// so Action and Customize stay aligned.
				this.draft = cloneConfig(mergeDraft(live, env.draft));
				this.savedAt = env.updated_at ?? '';
				this.savedBy = env.updated_by ?? '';
				this.isStale = Boolean(env.stale);
			} else {
				this.draft = cloneConfig(live);
				this.savedAt = '';
				this.savedBy = '';
				this.isStale = false;
			}
			this.error = '';
		} catch (err) {
			// No draft is a usable state; failing to reach the server is not a
			// reason to refuse to open the Studio.
			this.draft = cloneConfig(live);
			this.error = err instanceof Error ? err.message : '';
		} finally {
			this.isLoading = false;
			this.history = [];
		}
	}

	/**
	 * Keep Action and Customize in lockstep for operational fields.
	 * Does not touch draft autosave or mark the theme draft dirty.
	 */
	applyLiveOps(live: AdminStorefront) {
		if (!this.draft || !this.published) return;
		if (liveOpsEqual(this.draft, live) && liveOpsEqual(this.published, live)) return;
		const nextDraft = cloneConfig(this.draft);
		const nextPublished = cloneConfig(this.published);
		copyLiveOps(nextDraft, live);
		copyLiveOps(nextPublished, live);
		this.draft = nextDraft;
		this.published = nextPublished;
		setStorefrontAdmin(live);
	}

	/** Persist store status immediately (same API as Action). */
	async saveStoreStatus(status: string): Promise<boolean> {
		try {
			const live = await storefrontAdminApi.saveBehaviour({ store_status: status });
			this.applyLiveOps(live);
			patchDashboardStoreStatus(live.behaviour.store_status || status, {
				status_message: live.behaviour.status_message,
				store_status_label: live.behaviour.store_status_label
			});
			this.error = '';
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Could not update store status';
			return false;
		}
	}

	/** Persist customer banner immediately (same API as Action). */
	async saveStatusMessage(statusMessage: string): Promise<boolean> {
		try {
			const live = await storefrontAdminApi.saveBehaviour({ status_message: statusMessage });
			this.applyLiveOps(live);
			this.error = '';
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Could not update banner';
			return false;
		}
	}

	/** Persist opening hours immediately (same API as Action). */
	async saveHours(payload: {
		always_open: boolean;
		timezone: string;
		schedule: Record<string, string[]>;
	}): Promise<boolean> {
		try {
			const live = await storefrontAdminApi.saveHours(payload);
			this.applyLiveOps(live);
			this.error = '';
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Could not save opening hours';
			return false;
		}
	}

	/** Local-only hours preview while editing before Save (does not autosave the draft). */
	previewHours(patch: {
		always_open: boolean;
		timezone: string;
		schedule: Record<string, string[]>;
	}) {
		const next = cloneConfig(this.draft);
		next.hours.always_open = patch.always_open;
		next.hours.timezone = patch.timezone;
		next.hours.schedule = patch.schedule;
		this.draft = next;
	}

	/** Apply a change, remember it for undo, and schedule the autosave. */
	mutate(updater: (draft: AdminStorefront) => void) {
		if (this.history.length >= 25) this.history.shift();
		this.history.push(cloneConfig(this.draft));

		// Replace (don't mutate in place) so Studio preview and other
		// consumers reliably see each edit without deep-proxy gymnastics.
		const next = cloneConfig(this.draft);
		updater(next);
		next.theme.vars = computeClientThemeVars(next.theme);
		this.draft = next;
		this.scheduleSave();
	}

	scheduleSave() {
		this.#pending = true;
		if (this.#timer) clearTimeout(this.#timer);
		this.#timer = setTimeout(() => void this.saveNow(), AUTOSAVE_DELAY_MS);
	}

	/**
	 * Push the working copy to the server.
	 *
	 * Debounced rather than per-keystroke, and the whole document each time: the
	 * draft is one row, so a partial save has nothing to merge against and a
	 * dropped request would leave a hole nobody could see.
	 */
	async saveNow(): Promise<boolean> {
		if (this.#timer) {
			clearTimeout(this.#timer);
			this.#timer = null;
		}
		if (!this.#pending || !this.draft) return true;
		this.isSaving = true;
		try {
			const env = await api<DraftEnvelope>('/api/v1/tenant/customize/draft', {
				method: 'PUT',
				body: JSON.stringify(this.payload())
			});
			this.savedAt = env.updated_at ?? new Date().toISOString();
			this.isStale = Boolean(env.stale);
			this.#pending = false;
			this.error = '';
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Could not save your draft';
			return false;
		} finally {
			this.isSaving = false;
		}
	}

	undo(): boolean {
		const prev = this.history.pop();
		if (!prev) return false;
		this.draft = cloneConfig(prev);
		this.scheduleSave();
		return true;
	}

	/** Throw the draft away and go back to what customers see. */
	async discard(): Promise<boolean> {
		if (this.#timer) clearTimeout(this.#timer);
		this.#pending = false;
		try {
			const live = await api<AdminStorefront>('/api/v1/tenant/customize/draft', {
				method: 'DELETE'
			});
			this.published = cloneConfig(live);
			this.draft = cloneConfig(live);
			this.history = [];
			this.savedAt = '';
			this.savedBy = '';
			this.isStale = false;
			this.error = '';
			setStorefrontAdmin(live);
			return true;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Could not discard your draft';
			return false;
		}
	}

	/**
	 * Publish. One call, one transaction: it all lands or none of it does.
	 *
	 * `force` is the answer to a conflict the owner has been shown, never a
	 * default — the point of refusing a stale draft is that somebody gets to
	 * decide.
	 */
	async publish(force = false): Promise<'published' | 'conflict' | 'failed'> {
		if (!this.draft) return 'failed';
		// Flush anything the debounce is still holding, or publishing would
		// apply the previous keystroke's document.
		this.#pending = true;
		if (!(await this.saveNow())) return 'failed';

		this.isPublishing = true;
		this.error = '';
		try {
			const live = await api<AdminStorefront>(
				`/api/v1/tenant/customize/draft/publish${force ? '?force=true' : ''}`,
				{ method: 'POST' }
			);
			this.published = cloneConfig(live);
			this.draft = cloneConfig(live);
			this.history = [];
			this.savedAt = '';
			this.savedBy = '';
			this.isStale = false;
			setStorefrontAdmin(live);
			return 'published';
		} catch (err) {
			if (err instanceof ApiClientError && err.status === 409) {
				this.isStale = true;
				this.error = err.message;
				return 'conflict';
			}
			this.error = err instanceof Error ? err.message : 'Could not publish your changes';
			return 'failed';
		} finally {
			this.isPublishing = false;
		}
	}

	/** The document the API stores. Only what a draft may change. */
	payload() {
		const d = this.draft;
		return {
			store: {
				name: d.store.name,
				logo_url: d.store.logo_url,
				favicon_url: d.store.favicon_url,
				tagline: d.store.tagline,
				description: d.store.description,
				phone: d.store.phone,
				address: d.store.address
			},
			theme: {
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
				hero_image_url: d.theme.hero_image_url,
				customer_mode_switch_enabled: d.theme.customer_mode_switch_enabled
			},
			behaviour: {
				ordering_enabled: d.behaviour.ordering_enabled,
				closed_message: d.behaviour.closed_message,
				customer_login_mode: d.behaviour.customer_login_mode,
				prep_time_minutes: d.behaviour.prep_time_minutes,
				tax_percent: d.behaviour.tax_percent,
				packaging_fee: d.behaviour.packaging_fee,
				published: d.behaviour.published
			},
			homepage: { sections: d.homepage?.sections ?? [] },
			payments: d.payments,
			workflow: d.workflow
		};
	}

	get diffs(): DiffItem[] {
		if (!this.draft || !this.published) return [];
		return computeConfigDiff(this.draft, this.published);
	}

	get isDirty(): boolean {
		return this.diffs.length > 0;
	}

	/** Change count per category, for the section badges in the rail. */
	get diffsByCategory(): Record<string, number> {
		const out: Record<string, number> = {};
		for (const d of this.diffs) out[d.category] = (out[d.category] ?? 0) + 1;
		return out;
	}
}

/**
 * Lay a stored draft over the live config.
 *
 * The draft carries only what the Studio can change, so everything else — the
 * catalogues the pickers render from, opening hours, the resolved public URL —
 * must come from the live document or the screen would render against holes.
 *
 * Store status, customer banner and opening hours are live ops shared with
 * Action: even if an older draft still stores them, the live shop wins.
 */
function mergeDraft(live: AdminStorefront, draft: Partial<AdminStorefront>): AdminStorefront {
	const merged = mergeAdminDraft(live, draft);
	copyLiveOps(merged, live);
	return merged;
}
