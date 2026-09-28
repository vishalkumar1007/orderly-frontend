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

export type ColorMode = 'light' | 'dark' | 'system';

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
	/** Resolved light/dark, after `system` has been asked of the browser. */
	mode: 'light' | 'dark';
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

function resolveMode(colorMode: ColorMode): 'light' | 'dark' {
	if (colorMode === 'light' || colorMode === 'dark') return colorMode;
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
	state.kind = kind;
	state.scope = scope;
	state.appearance = appearance;
	state.mode = resolveMode(appearance.theme.color_mode);
	applyBrandTheme(appearance.theme);
	setCachedBrandTheme(scope || 'console', appearance.theme);
	storeTheme(scope, appearance.theme);
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
export function saveAppearance(
	kind: ConsoleKind,
	patch: AppearanceWrite
): Promise<ConsoleAppearance> {
	return api<ConsoleAppearance>(endpoint(kind), {
		method: 'PATCH',
		body: JSON.stringify(patch)
	});
}

/** Drop the personal layer and go back to the default. */
export function resetAppearance(kind: ConsoleKind): Promise<ConsoleAppearance> {
	return api<ConsoleAppearance>(endpoint(kind), { method: 'DELETE' });
}

/**
 * Set light/dark for the signed-in person.
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
