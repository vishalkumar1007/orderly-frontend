export type BrandTokens = {
	accent: string;
	accent2: string;
	radius_sm: string;
	radius: string;
	radius_lg: string;
	font_display: string;
	font_body: string;
};

export type BrandTheme = {
	preset_id: string;
	preset_name?: string;
	color_mode: 'light' | 'dark' | 'system';
	tokens: BrandTokens;
};

export type ThemePreset = {
	id: string;
	name: string;
	tokens: BrandTokens;
};

function hexToRgb(hex: string): string | null {
	const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
	if (!m) return null;
	const n = Number.parseInt(m[1], 16);
	return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** Every property `applyBrandTheme` writes as an inline override. */
const BRAND_VARS = [
	'--accent',
	'--accent-2',
	'--accent-dark',
	'--accent-rgb',
	'--radius-sm',
	'--radius',
	'--radius-lg',
	'--font',
	'--font-display'
] as const;

/**
 * The brand properties a theme resolves to, as `[property, value]` pairs.
 *
 * One function, two consumers: `applyBrandTheme` writes these onto `<html>` in
 * the browser, and `brandVars` renders the same list as an inline style during
 * SSR. A signed-out sign-in page can only use the second — it has no token to
 * fetch with — so if the two were written separately the page would quietly end
 * up with a subset of the console's brand, which is the bug this avoids.
 */
function brandPairs(theme: BrandTheme): Array<[string, string]> {
	const t = theme.tokens;
	const pairs: Array<[string, string]> = [
		['--accent', t.accent],
		['--accent-2', t.accent2],
		// Hover/pressed states darken the same hue, so they track one colour.
		['--accent-dark', t.accent]
	];
	const rgb = hexToRgb(t.accent);
	if (rgb) pairs.push(['--accent-rgb', rgb]);
	pairs.push(
		['--radius-sm', t.radius_sm],
		['--radius', t.radius],
		['--radius-lg', t.radius_lg]
	);
	if (t.font_body) pairs.push(['--font', `'${t.font_body}', system-ui, sans-serif`]);
	if (t.font_display) pairs.push(['--font-display', `'${t.font_display}', system-ui, sans-serif`]);
	return pairs;
}

/**
 * The same brand overrides as a CSS inline declaration, for server rendering.
 *
 * Pure, so it is safe to call during SSR. Every value is checked for emptiness
 * first: a blank custom property in an inline style still overrides the
 * stylesheet, which would blank out the accent rather than leaving it alone.
 */
export function brandVars(theme: BrandTheme | null | undefined): string {
	if (!theme?.tokens) return '';
	return brandPairs(theme)
		.filter(([, value]) => value !== '' && value !== undefined && value !== null)
		.map(([prop, value]) => `${prop}:${value}`)
		.join(';');
}

export function applyBrandTheme(theme: BrandTheme) {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	for (const [prop, value] of brandPairs(theme)) {
		if (value === '' || value === undefined || value === null) continue;
		root.style.setProperty(prop, value);
	}
	let mode: 'light' | 'dark' = theme.color_mode === 'dark' ? 'dark' : 'light';
	if (theme.color_mode === 'system') {
		mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	}
	root.dataset.theme = mode;
}

/**
 * Drop any tenant brand override so the platform portal renders with its own
 * tokens. Without this a tenant's accent/radius/font leaks across client-side
 * navigation and tints the Super Admin console.
 */
export function clearBrandTheme() {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	for (const prop of BRAND_VARS) root.style.removeProperty(prop);
}
