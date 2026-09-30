/**
 * Console appearance — one module, both consoles.
 *
 * Two layers, and the distinction is the reason this exists:
 *
 * - the **default** is shared. For a business it is what the owner set for
 *   everyone who works there; for the platform it is the operator's branding.
 *   It paints a sign-in screen, a setup link and a colleague's first session.
 * - the **personal** layer belongs to one person, stored against their user
 *   account, so it follows them to another device and reaches nobody else.
 *
 * The backend resolves the two and says which is in force, exactly as it does
 * for provider configuration: the client never merges them itself.
 *
 * It also owns light/dark. That used to be a second, unrelated system writing
 * `data-theme` straight from `localStorage`, which meant the toggle and the
 * saved colour mode disagreed the moment either changed — the toggle won until
 * a reload, then the account won. There is one writer now, and the toggle is
 * simply a shortcut for setting your own `color_mode`.
 */
import { ApiClientError, api, getAccessToken } from '$lib/api/client';
import { applyBrandTheme, setCachedBrandTheme, type BrandTheme } from '$lib/brandTheme';

export type ColorMode =
	| 'light'
	| 'soft'
	| 'mist'
	| 'dark'
	| 'graphite'
	| 'raw'
	| 'night'
	| 'midnight'
	| 'system';

/** Resolved surface theme painted on <html data-theme>. */
export type ResolvedThemeMode = Exclude<ColorMode, 'system'>;

/**
 * Dashboard looks inspired by common admin/SaaS themes (Linear charcoal, OLED
 * raw black, midnight slate, paper soft, cool mist) — some with a coloured
 * wash, some flat.
 */
export const COLOR_MODES: Array<{
	id: ColorMode;
	label: string;
	hint: string;
	swatch: string;
	/** How strong the accent page wash is. */
	wash: 'none' | 'subtle' | 'medium' | 'strong';
}> = [
	{ id: 'light', label: 'Light', hint: 'Bright white · faint wash', swatch: '#f7f8fb', wash: 'subtle' },
	{ id: 'soft', label: 'Soft', hint: 'Warm paper · coloured wash', swatch: '#f3f1ec', wash: 'strong' },
	{ id: 'mist', label: 'Mist', hint: 'Cool light · barely tinted', swatch: '#f4f6f9', wash: 'subtle' },
	{ id: 'dark', label: 'Dark', hint: 'Navy dark · accent glow', swatch: '#10121d', wash: 'medium' },
	{ id: 'graphite', label: 'Graphite', hint: 'Flat dark · no colour wash', swatch: '#141416', wash: 'none' },
	{ id: 'raw', label: 'Raw', hint: 'OLED black · no colour wash', swatch: '#050505', wash: 'none' },
	{ id: 'night', label: 'Night', hint: 'Charcoal · strong colour wash', swatch: '#121214', wash: 'strong' },
	{ id: 'midnight', label: 'Midnight', hint: 'Slate navy · medium wash', swatch: '#0f172a', wash: 'medium' },
	{ id: 'system', label: 'System', hint: 'Follow device setting', swatch: 'linear-gradient(135deg,#f7f8fb 50%,#10121d 50%)', wash: 'subtle' }
];

const COLOR_MODE_IDS = new Set(COLOR_MODES.map((m) => m.id));

export function isValidColorMode(mode: string): mode is ColorMode {
	return COLOR_MODE_IDS.has(mode as ColorMode);
}

export function isDarkFamily(mode: ResolvedThemeMode | ColorMode): boolean {
	return (
		mode === 'dark' ||
		mode === 'night' ||
		mode === 'midnight' ||
		mode === 'graphite' ||
		mode === 'raw'
	);
}

/** Which console is asking. They share a column and differ only in the default. */
export type ConsoleKind = 'tenant' | 'platform';

/** What a person has chosen for themselves. `null` means "follow the default". */
export type PersonalTheme = {
	preset_id: string;
	color_mode: ColorMode;
	overrides?: Record<string, string>;
};

export type ConsoleAppearance = {
	/** The theme to paint with — the personal layer if there is one. */
	theme: BrandTheme;
	/** The default, whether or not it is in force. */
	business: BrandTheme;
	source: 'USER' | 'BUSINESS';
	personal: PersonalTheme | null;
};

export type AppearanceWrite = {
	preset_id?: string;
	color_mode?: ColorMode;
	overrides?: Record<string, string>;
};

function endpoint(kind: ConsoleKind): string {
	return kind === 'platform' ? '/api/v1/admin/me/appearance' : '/api/v1/tenant/me/appearance';
}

/** The shared default, for the fallback path where no personal layer exists. */
function defaultEndpoint(kind: ConsoleKind): string {
	return kind === 'platform' ? '/api/v1/admin/settings' : '/api/v1/tenant/theme';
}

/* ------------------------------------------------------------------ *
 * Browser storage: a cache for the first frame, never the record.
 *
 * The account holds the truth. A cleared or blocked store costs one frame of
 * the built-in accent and nothing else, so every read and write is guarded.
 * ------------------------------------------------------------------ */

function storageKey(scope: string): string {
	return `orderly-console-appearance:${scope || 'console'}`;
}

/** Remembers Soft/Night when the API still only accepts light/dark/system. */
function surfaceKey(scope: string): string {
	return `orderly-console-surface:${scope || 'console'}`;
}

export function readStoredSurface(scope: string): ColorMode | null {
	try {
		const raw = localStorage.getItem(surfaceKey(scope));
		if (raw && isValidColorMode(raw)) return raw;
	} catch {
		/* ignore */
	}
	return null;
}

export function storeSurface(scope: string, mode: ColorMode): void {
	try {
		localStorage.setItem(surfaceKey(scope), mode);
	} catch {
		/* ignore */
	}
}

/** Map extended looks onto light/dark for older appearance validators. */
export function apiColorMode(mode: ColorMode): 'light' | 'dark' | 'system' {
	if (mode === 'system') return 'system';
	return isDarkFamily(mode) ? 'dark' : 'light';
}

/** Prefer an explicit dashboard look over a mapped light/dark from the API. */
export function restoreSurfaceMode(scope: string, apiMode: ColorMode): ColorMode {
	const stored = readStoredSurface(scope);
	if (!stored) return apiMode;
	if (stored === apiMode) return stored;
	if (apiColorMode(stored) === apiColorMode(apiMode)) return stored;
	return apiMode;
}

export function readStoredTheme(scope: string): BrandTheme | null {
	try {
		const raw = localStorage.getItem(storageKey(scope));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as BrandTheme;
		return parsed?.tokens ? parsed : null;
	} catch {
		return null;
	}
}

export function storeTheme(scope: string, theme: BrandTheme): void {
	try {
		localStorage.setItem(storageKey(scope), JSON.stringify(theme));
	} catch {
		/* private window, or storage is full */
	}
}

export function clearStoredTheme(scope: string): void {
	try {
		localStorage.removeItem(storageKey(scope));
	} catch {
		/* nothing to clear */
	}
}

/* ------------------------------------------------------------------ *
 * The live appearance for this session.
 *
 * A module-level rune rather than a context: the topbar toggle, the Appearance
 * screen and the root layout all need the same answer, and they are nowhere
 * near each other in the tree. One value means the toggle cannot show light
 * while the account says dark.
 * ------------------------------------------------------------------ */

const state = $state<{
	kind: ConsoleKind;
	scope: string;
	appearance: ConsoleAppearance | null;
	/** Resolved surface theme after `system` has been asked of the browser. */
	mode: ResolvedThemeMode;
}>({ kind: 'tenant', scope: '', appearance: null, mode: 'light' });

export const consoleAppearance = {
	get appearance() {
		return state.appearance;
	},
	get mode() {
		return state.mode;
	},
	get colorMode(): ColorMode {
		return state.appearance?.theme.color_mode ?? 'system';
	},
	get source() {
		return state.appearance?.source ?? 'BUSINESS';
	},
	get kind() {
		return state.kind;
	}
};

function resolveMode(colorMode: ColorMode): ResolvedThemeMode {
	if (colorMode !== 'system' && isValidColorMode(colorMode)) return colorMode;
	if (typeof window === 'undefined') return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Publish a resolved appearance everywhere the console reads it from: the
 * painted page, the session cache the root layout checks, the browser store
 * that beats the first paint, and this module's own state.
 *
 * One call site for all of them, so a saved theme can never be live in one
 * place and stale in another.
 */
export function adoptAppearance(
	kind: ConsoleKind,
	scope: string,
	appearance: ConsoleAppearance
): void {
	const restoredMode = restoreSurfaceMode(scope, appearance.theme.color_mode);
	const next: ConsoleAppearance = {
		...appearance,
		theme: { ...appearance.theme, color_mode: restoredMode }
	};
	state.kind = kind;
	state.scope = scope;
	state.appearance = next;
	state.mode = resolveMode(restoredMode);
	applyBrandTheme(next.theme);
	setCachedBrandTheme(scope || 'console', next.theme);
	storeTheme(scope, next.theme);
	storeSurface(scope, restoredMode);
}

/**
 * Reflect an unsaved preview in the shared state.
 *
 * The Appearance screen paints edits as they are made, and the topbar's
 * light/dark toggle reads the same state — without this it would keep showing
 * the saved mode while the page beside it was already painted in the new one.
 * Deliberately does not touch storage: nothing is saved yet.
 */
export function previewColorMode(colorMode: ColorMode): void {
	state.mode = resolveMode(colorMode);
}

/** Forget the session's appearance, e.g. on sign-out. */
export function forgetAppearance(scope: string): void {
	state.appearance = null;
	clearStoredTheme(scope);
}

/**
 * Resolve this person's appearance.
 *
 * Falls back to the shared default when the endpoint is missing, so a console
 * served by an older API renders instead of erroring — the personal layer is an
 * enhancement, not a prerequisite for signing in.
 */
export async function loadAppearance(kind: ConsoleKind): Promise<ConsoleAppearance> {
	try {
		return await api<ConsoleAppearance>(endpoint(kind));
	} catch (err) {
		if (err instanceof ApiClientError && err.status === 404) {
			const fallback = await loadDefaultOnly(kind);
			return { theme: fallback, business: fallback, source: 'BUSINESS', personal: null };
		}
		throw err;
	}
}

async function loadDefaultOnly(kind: ConsoleKind): Promise<BrandTheme> {
	if (kind === 'tenant') return api<BrandTheme>(defaultEndpoint(kind));
	// The platform has no standalone theme endpoint; its default lives on the
	// settings document.
	const settings = await api<{
		branding?: { primary_color?: string; secondary_color?: string; color_mode?: ColorMode };
	}>(defaultEndpoint(kind));
	return {
		preset_id: 'indigo-violet',
		color_mode: settings.branding?.color_mode ?? 'system',
		tokens: {
			accent: settings.branding?.primary_color || '#4f46e5',
			accent2: settings.branding?.secondary_color || '#6366f1',
			radius_sm: '6px',
			radius: '8px',
			radius_lg: '12px',
			font_display: 'Inter',
			font_body: 'Inter'
		}
	};
}

/** Save a partial personal choice and get the resolved appearance back. */
export async function saveAppearance(
	kind: ConsoleKind,
	patch: AppearanceWrite
): Promise<ConsoleAppearance> {
	const preferred = patch.color_mode;
	const body: AppearanceWrite = preferred
		? { ...patch, color_mode: apiColorMode(preferred) }
		: patch;
	try {
		const saved = await api<ConsoleAppearance>(endpoint(kind), {
			method: 'PATCH',
			body: JSON.stringify(preferred ? { ...patch, color_mode: preferred } : patch)
		});
		if (preferred) storeSurface(state.scope || 'console', preferred);
		return preferred
			? { ...saved, theme: { ...saved.theme, color_mode: preferred } }
			: saved;
	} catch (err) {
		// Older APIs reject extended looks — persist the closest classic mode and
		// keep the richer surface choice in the browser so the console still paints.
		if (preferred && preferred !== 'light' && preferred !== 'dark' && preferred !== 'system') {
			const saved = await api<ConsoleAppearance>(endpoint(kind), {
				method: 'PATCH',
				body: JSON.stringify(body)
			});
			storeSurface(state.scope || 'console', preferred);
			return { ...saved, theme: { ...saved.theme, color_mode: preferred } };
		}
		throw err;
	}
}

/** Drop the personal layer and go back to the default. */
export function resetAppearance(kind: ConsoleKind): Promise<ConsoleAppearance> {
	return api<ConsoleAppearance>(endpoint(kind), { method: 'DELETE' });
}

/**
 * Set the console surface theme for the signed-in person.
 *
 * Paints first and persists after: a theme toggle that waits for a round trip
 * feels broken, and the worst case if the write fails is that the next reload
 * shows what the account still says.
 */
export async function setColorMode(mode: ColorMode): Promise<void> {
	const current = state.appearance;
	state.mode = resolveMode(mode);

	if (current) {
		const painted: ConsoleAppearance = {
			...current,
			theme: { ...current.theme, color_mode: mode }
		};
		state.appearance = painted;
		applyBrandTheme(painted.theme);
		storeTheme(state.scope, painted.theme);
	} else if (typeof document !== 'undefined') {
		// No appearance yet (signed out, or still loading): the storefront and
		// the sign-in screens still need the class to flip.
		document.documentElement.dataset.theme = state.mode;
	}

	if (typeof localStorage === 'undefined' || !getAccessToken()) return;

	try {
		const saved = await saveAppearance(state.kind, { color_mode: mode });
		adoptAppearance(state.kind, state.scope, saved);
	} catch {
		/* Painted already; the account keeps whatever it had. */
	}
}

/** Flip between the light and dark families, pairing related looks when possible. */
export async function toggleColorMode(): Promise<void> {
	const current = state.appearance?.theme.color_mode ?? state.mode;
	let next: ColorMode;
	switch (current) {
		case 'soft':
			next = 'night';
			break;
		case 'night':
			next = 'soft';
			break;
		case 'mist':
			next = 'graphite';
			break;
		case 'graphite':
			next = 'mist';
			break;
		case 'midnight':
			next = 'soft';
			break;
		case 'raw':
			next = 'light';
			break;
		case 'dark':
			next = 'light';
			break;
		case 'light':
			next = 'dark';
			break;
		default:
			next = isDarkFamily(state.mode) ? 'light' : 'dark';
	}
	await setColorMode(next);
}
