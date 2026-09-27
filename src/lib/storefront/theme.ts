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
