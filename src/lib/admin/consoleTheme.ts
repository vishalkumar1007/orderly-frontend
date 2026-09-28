import type { ThemePreset } from '$lib/brandTheme';

/**
 * Turning a chosen storefront look into the business's console theme.
 *
 * Onboarding asks for one look, and that look is the business's — not just its
 * shop window. A new owner signing in to a console painted in a stock indigo
 * they never chose reads as "the theme did not save"; worse, the setup link and
 * the sign-in screen they see *first* are painted from the console theme, so
 * the very first impression was the one place the choice did not reach.
 *
 * The two catalogues are genuinely different — a storefront preset carries hero
 * and card styles a console has no use for — so this maps rather than shares.
 * The nearest console preset supplies the radii and fonts; the two colours the
 * operator actually picked ride along as overrides, so the console shows those
 * exact colours and "reset to preset" still means something later.
 *
 * The owner can move either side afterwards: the console under
 * Settings → Appearance, the storefront under Customize → Theme.
 */
export type StorefrontLook = {
	primary: string;
	secondary: string;
	mode: string;
};

export type ConsoleThemeSeed = {
	theme_preset_id: string;
	theme_color_mode: 'light' | 'dark' | 'system';
	theme_overrides: { accent?: string; accent2?: string };
};

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

function rgb(hex: string): [number, number, number] | null {
	const m = HEX_RE.exec(hex.trim());
	if (!m) return null;
	const n = Number.parseInt(m[1], 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Distance in plain RGB.
 *
 * Not perceptually uniform, and it does not need to be: the chosen colour is
 * applied verbatim as an override, so this only decides which preset's radii
 * and fonts come along and which swatch appears selected.
 */
function distance(a: [number, number, number], b: [number, number, number]): number {
	return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

/** The console preset closest to a colour, or the first one if it is not a hex. */
export function nearestPreset(hex: string, presets: readonly ThemePreset[]): ThemePreset | null {
	if (presets.length === 0) return null;
	const target = rgb(hex);
	if (!target) return presets[0];
	let best = presets[0];
	let bestScore = Number.POSITIVE_INFINITY;
	for (const preset of presets) {
		const candidate = rgb(preset.tokens.accent);
		if (!candidate) continue;
		const score = distance(target, candidate);
		if (score < bestScore) {
			bestScore = score;
			best = preset;
		}
	}
	return best;
}

/**
 * The console theme fields for `POST /admin/tenants`.
 *
 * Returns `null` when there is no catalogue to map onto — the business is then
 * created with the server's own default rather than with a preset id that does
 * not exist, which the API would reject outright.
 */
export function consoleThemeSeed(
	look: StorefrontLook,
	presets: readonly ThemePreset[]
): ConsoleThemeSeed | null {
	const preset = nearestPreset(look.primary, presets);
	if (!preset) return null;

	const overrides: { accent?: string; accent2?: string } = {};
	if (HEX_RE.test(look.primary.trim())) overrides.accent = look.primary.trim().toLowerCase();
	if (HEX_RE.test(look.secondary.trim())) overrides.accent2 = look.secondary.trim().toLowerCase();

	// A storefront preset says light or dark outright. The console's third
	// option — follow the operating system — is a personal preference rather
	// than a brand decision, so it is never what onboarding picks.
	const mode = look.mode === 'dark' ? 'dark' : 'light';

	return {
		theme_preset_id: preset.id,
		theme_color_mode: mode,
		theme_overrides: overrides
	};
}
