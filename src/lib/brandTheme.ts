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

export function applyBrandTheme(theme: BrandTheme) {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	const tokens = theme.tokens;
	root.style.setProperty('--accent', tokens.accent);
	root.style.setProperty('--accent-2', tokens.accent2);
	root.style.setProperty('--accent-dark', tokens.accent);
	const rgb = hexToRgb(tokens.accent);
	if (rgb) root.style.setProperty('--accent-rgb', rgb);
	root.style.setProperty('--radius-sm', tokens.radius_sm);
	root.style.setProperty('--radius', tokens.radius);
	root.style.setProperty('--radius-lg', tokens.radius_lg);
	if (tokens.font_body) {
		root.style.setProperty('--font', `'${tokens.font_body}', system-ui, sans-serif`);
	}
	if (tokens.font_display) {
		root.style.setProperty('--font-display', `'${tokens.font_display}', system-ui, sans-serif`);
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
