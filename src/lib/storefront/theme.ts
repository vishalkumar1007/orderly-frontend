/**
 * Storefront design tokens.
 *
 * The storefront's appearance is decided on the server: the API resolves a
 * tenant's theme into a flat map of CSS custom properties, and this module's
 * only job is to type that payload and turn it into the style string the layout
 * puts on its root element.
 *
 * There is deliberately no way to inject a token from the client. A tenant picks
 * a preset and three colours; every other value comes from a closed enum the
 * server validates. That is what keeps "no arbitrary CSS" true in practice
 * rather than only in the docs.
 */

export type ThemePresetId =
	| 'classic'
	| 'modern'
	| 'street-food'
	| 'minimal'
	| 'fresh'
	| 'dark';

export type ThemeMode = 'light' | 'dark' | 'system';
export type FontId = 'inter' | 'sora' | 'poppins' | 'system';
export type RadiusId = 'none' | 'sm' | 'md' | 'lg' | 'pill';
export type ButtonStyleId = 'rounded' | 'pill' | 'square' | 'soft';
export type CardStyleId = 'elevated' | 'outlined' | 'filled' | 'minimal';
export type HeaderStyleId = 'sticky' | 'solid' | 'transparent';
export type HeroStyleId = 'image' | 'gradient' | 'compact' | 'none';
export type ProductLayoutId = 'list' | 'grid' | 'compact';
export type FilterStyleId = 'chips' | 'pills' | 'rail';
export type CustomerLoginMode = 'off' | 'optional' | 'required';

/** The theme as the public API returns it. */
export type StoreTheme = {
	preset: ThemePresetId;
	mode: ThemeMode;
	font: FontId;
	radius: RadiusId;
	button: ButtonStyleId;
	card: CardStyleId;
	header: HeaderStyleId;
	hero: HeroStyleId;
	product_layout: ProductLayoutId;
	filter_style: FilterStyleId;
	primary: string;
	secondary: string;
	accent: string;
	hero_image_url?: string;
	/** Resolved CSS custom properties, e.g. `--sf-primary`. */
	vars: Record<string, string>;
	/** The resolved font stack, and the Google Fonts families to load. */
	font_stack?: string;
	font_import?: string;
};

export const FONT_IMPORTS: Record<FontId, string> = {
	// The app shell already loads Inter, so only a different choice needs a
	// request. Keeping this map in sync with the server's FontImports means a
	// storefront never falls back to a system face after the first paint.
	inter: '',
	sora: 'Sora:wght@600;700;800',
	poppins: 'Poppins:wght@400;500;600;700',
	system: ''
};

export function fontImportFor(font: FontId): string {
	const family = FONT_IMPORTS[font];
	if (!family) return '';
	return `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}&display=swap`;
}

/** Fallback tokens, used before the store config arrives and in tests. */
export const FALLBACK_THEME: StoreTheme = {
	preset: 'modern',
	mode: 'system',
	font: 'inter',
	radius: 'md',
	button: 'rounded',
	card: 'elevated',
	header: 'sticky',
	hero: 'gradient',
	product_layout: 'list',
	filter_style: 'chips',
	primary: '#5b4bdb',
	secondary: '#8b5cf6',
	accent: '#06b6d4',
	vars: {},
	font_stack: "'Inter', system-ui, sans-serif"
};

/** The minimum token set the stylesheet depends on. */
const REQUIRED_VARS = [
	'--sf-primary',
	'--sf-primary-ink',
	'--sf-primary-soft',
	'--sf-primary-rgb',
	'--sf-secondary',
	'--sf-accent',
	'--sf-accent-ink',
	'--sf-radius',
	'--sf-radius-sm',
	'--sf-radius-lg',
	'--sf-font'
];

/**
 * `themeVars` renders the token map as a `style` attribute value.
 *
 * The storefront layout writes this onto its root element during server-side
 * rendering, so the very first painted frame is already the tenant's colours —
 * there is no flash of a default theme while the config request resolves.
 */
export function themeVars(theme: StoreTheme | null | undefined): string {
	if (!theme?.vars) return '';
	return Object.entries(theme.vars)
		.filter(([key, value]) => key.startsWith('--sf-') && typeof value === 'string')
		.map(([key, value]) => `${key}:${sanitiseValue(value)}`)
		.join(';');
}

/**
 * A token value is written into a style attribute, so anything that could end
 * the declaration early or smuggle in extra CSS is dropped rather than escaped.
 * The server only ever sends colours, sizes and font stacks, so anything that
 * fails this is a bug or an attack and is ignored.
 */
function sanitiseValue(value: string): string {
	const trimmed = value.trim();
	if (/[;{}<>\\]/.test(trimmed)) return '';
	// A custom property may legitimately contain commas (rgb triplets, font
	// stacks) and spaces, but never a url() or an expression.
	if (/url\s*\(|expression|@import|javascript:/i.test(trimmed)) return '';
	return trimmed;
}

/** `hasCompleteTokens` guards against a partial payload rendering unstyled. */
export function hasCompleteTokens(theme: StoreTheme | null | undefined): boolean {
	if (!theme?.vars) return false;
	return REQUIRED_VARS.every((key) => Boolean(theme.vars[key]));
}

/** `resolveThemeMode` turns a `system` theme mode into a concrete one. */
export function resolveThemeMode(mode: ThemeMode): 'light' | 'dark' {
	if (mode === 'dark') return 'dark';
	if (mode === 'light') return 'light';
	if (typeof window === 'undefined') return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
	let clean = hex.replace('#', '').trim();
	if (clean.length === 3) {
		clean = clean.split('').map((c) => c + c).join('');
	}
	const num = parseInt(clean, 16);
	if (isNaN(num) || clean.length !== 6) {
		return { r: 91, g: 75, b: 219 };
	}
	return {
		r: (num >> 16) & 255,
		g: (num >> 8) & 255,
		b: num & 255
	};
}

function contrastInk(hex: string): string {
	const { r, g, b } = hexToRgb(hex);
	const yiq = (r * 299 + g * 587 + b * 114) / 1000;
	return yiq >= 150 ? '#0f172a' : '#ffffff';
}

function soften(hex: string, alpha: number): string {
	const { r, g, b } = hexToRgb(hex);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const RADIUS_SCALES: Record<RadiusId, [string, string, string, string]> = {
	none: ['0px', '0px', '0px', '0px'],
	sm: ['2px', '4px', '6px', '8px'],
	md: ['4px', '8px', '12px', '16px'],
	lg: ['6px', '12px', '18px', '24px'],
	pill: ['8px', '16px', '24px', '32px']
};

const BUTTON_RADII: Record<ButtonStyleId, string> = {
	rounded: 'var(--sf-radius)',
	pill: '999px',
	square: '0px',
	soft: 'var(--sf-radius-lg)'
};

const FONT_STACKS: Record<FontId, string> = {
	inter: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
	sora: "'Sora', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
	poppins: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
	system: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
};

/** Compute full CSS custom properties on client for instant reactive preview. */
export function computeClientThemeVars(theme: StoreTheme): Record<string, string> {
	const primary = theme.primary || '#5b4bdb';
	const secondary = theme.secondary || '#8b5cf6';
	const accent = theme.accent || '#06b6d4';
	const radiusId = (theme.radius in RADIUS_SCALES ? theme.radius : 'md') as RadiusId;
	const buttonId = (theme.button in BUTTON_RADII ? theme.button : 'rounded') as ButtonStyleId;
	const fontId = (theme.font in FONT_STACKS ? theme.font : 'inter') as FontId;

	const pRgb = hexToRgb(primary);
	const sRgb = hexToRgb(secondary);
	const aRgb = hexToRgb(accent);
	const scale = RADIUS_SCALES[radiusId];

	return {
		'--sf-primary': primary,
		'--sf-primary-rgb': `${pRgb.r}, ${pRgb.g}, ${pRgb.b}`,
		'--sf-primary-ink': contrastInk(primary),
		'--sf-primary-soft': soften(primary, 0.12),
		'--sf-primary-softer': soften(primary, 0.05),
		'--sf-secondary': secondary,
		'--sf-secondary-rgb': `${sRgb.r}, ${sRgb.g}, ${sRgb.b}`,
		'--sf-secondary-ink': contrastInk(secondary),
		'--sf-accent': accent,
		'--sf-accent-rgb': `${aRgb.r}, ${aRgb.g}, ${aRgb.b}`,
		'--sf-accent-ink': contrastInk(accent),
		'--sf-accent-soft': soften(accent, 0.14),
		'--sf-radius-xs': scale[0],
		'--sf-radius-sm': scale[1],
		'--sf-radius': scale[2],
		'--sf-radius-lg': scale[3],
		'--sf-radius-pill': '999px',
		'--sf-btn-radius': BUTTON_RADII[buttonId],
		'--sf-font': FONT_STACKS[fontId],
		'--sf-font-display': FONT_STACKS[fontId],
		'--sf-font-weight': fontId === 'sora' ? '700' : '600',
		'--sf-btn-transform': buttonId === 'square' ? 'none' : 'scale(0.97)',
		'--sf-card-shadow':
			theme.card === 'elevated'
				? 'var(--sf-shadow-md)'
				: theme.card === 'outlined'
					? 'var(--sf-shadow-xs)'
					: 'none',
		'--sf-card-border':
			theme.card === 'outlined' ? 'var(--sf-border-strong)' : 'transparent',
		'--sf-card-bg': 'var(--sf-surface)',
		'--sf-header-position': theme.header === 'sticky' ? 'sticky' : 'relative',
		'--sf-header-bg': theme.header === 'transparent' ? 'transparent' : 'var(--sf-surface)',
		'--sf-header-ink': 'var(--sf-text)',
		'--sf-hero-min-height':
			theme.hero === 'image'
				? '230px'
				: theme.hero === 'gradient'
					? '185px'
					: theme.hero === 'compact'
						? 'auto'
						: '0px',
		'--sf-hero-radius': theme.hero === 'compact' ? 'var(--sf-radius-lg)' : '0px',
		'--sf-hero-gradient': `linear-gradient(135deg, ${soften(primary, 0.85)} 0%, ${soften(secondary, 0.88)} 55%, ${soften(accent, 0.85)} 100%)`,
		'--sf-hero-align': theme.hero === 'image' ? 'flex-end' : 'center',
		'--sf-section-space': theme.hero === 'compact' ? '20px' : '26px',
		'--sf-image-fit': 'cover',
		'--sf-product-layout': theme.product_layout || 'list',
		'--sf-filter-style': theme.filter_style || 'chips',
		'--sf-focus-ring': `color-mix(in srgb, ${primary} 35%, transparent)`
	};
}

