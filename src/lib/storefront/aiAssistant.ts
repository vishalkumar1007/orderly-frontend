import type { AdminStorefront } from './admin';
import { THEME_PRESETS } from './admin';
import { computeClientThemeVars } from './theme';

export type AiChange = {
	field: string;
	from: string;
	to: string;
};

export type AiProposal = {
	prompt: string;
	summary: string;
	changes: AiChange[];
	updatedConfig: AdminStorefront;
};

/** Popular quick suggestions aligned with real business intents */
export const AI_SUGGESTIONS = [
	'Make my store modern and premium.',
	'Use red and black.',
	'Make the menu easier to use on mobile.',
	'Make product cards larger.',
	'Create a clean bakery-style storefront.',
	'Fresh organic juice bar vibe with green palette.',
	'Minimalist boutique retail with monochrome look.'
];

/**
 * AI Design Assistant Engine.
 *
 * Strictly modifies ONLY controlled storefront configuration tokens.
 * NEVER outputs raw HTML, CSS or JS.
 */
export function processAiDesignRequest(
	prompt: string,
	currentConfig: AdminStorefront
): AiProposal {
	const text = prompt.toLowerCase().trim();
	const next: AdminStorefront = JSON.parse(JSON.stringify(currentConfig));
	const changes: AiChange[] = [];

	function trackChange(field: string, fromVal: string, toVal: string) {
		if (fromVal !== toVal) {
			changes.push({ field, from: fromVal, to: toVal });
		}
	}

	let summary = '';

	// 1. "Make my store modern and premium"
	if (text.includes('modern') && (text.includes('premium') || text.includes('clean') || text.includes('sleek'))) {
		const oldPreset = next.theme.preset;
		next.theme.preset = 'modern';
		next.theme.primary = '#5b4bdb';
		next.theme.secondary = '#8b5cf6';
		next.theme.accent = '#06b6d4';
		next.theme.font = 'inter';
		next.theme.radius = 'lg';
		next.theme.button = 'soft';
		next.theme.card = 'elevated';
		next.theme.hero = 'gradient';
		next.theme.product_layout = 'grid';

		trackChange('Theme Preset', oldPreset, 'Modern');
		trackChange('Primary Color', currentConfig.theme.primary, '#5b4bdb');
		trackChange('Button Style', currentConfig.theme.button, 'Soft');
		trackChange('Card Style', currentConfig.theme.card, 'Elevated');
		trackChange('Menu Layout', currentConfig.theme.product_layout, 'Grid');
		summary = 'Applied Modern & Premium styling with Indigo/Violet palette, Soft buttons, and Elevated cards.';
	}
	// 2. "Use red and black"
	else if (
		(text.includes('red') && text.includes('black')) ||
		text.includes('crimson and dark') ||
		text.includes('red and dark')
	) {
		const oldPreset = next.theme.preset;
		next.theme.preset = 'dark';
		next.theme.mode = 'dark';
		next.theme.primary = '#ef4444';
		next.theme.secondary = '#b91c1c';
		next.theme.accent = '#f87171';
		next.theme.card = 'elevated';
		next.theme.button = 'rounded';
		next.theme.radius = 'md';

		trackChange('Theme Preset', oldPreset, 'Dark (Red & Black)');
		trackChange('Color Mode', currentConfig.theme.mode, 'Dark');
		trackChange('Primary Color', currentConfig.theme.primary, '#ef4444');
		trackChange('Secondary Color', currentConfig.theme.secondary, '#b91c1c');
		summary = 'Configured Dark mode with high-contrast crimson red and charcoal blacks.';
	}
	// 3. "Make the menu easier to use on mobile"
	else if (text.includes('mobile') || text.includes('easier on mobile') || text.includes('phone')) {
		const oldLayout = next.theme.product_layout;
		next.theme.product_layout = 'list';
		next.theme.filter_style = 'chips';
		next.theme.header = 'sticky';
		next.theme.button = 'pill';
		next.theme.radius = 'lg';

		trackChange('Menu Layout', oldLayout, 'List (Optimal for mobile scanning)');
		trackChange('Category Filter Style', currentConfig.theme.filter_style, 'Chips (Horizontal swipeable)');
		trackChange('Header Behavior', currentConfig.theme.header, 'Sticky');
		summary = 'Optimized layout for mobile devices: horizontal category chips, fast-scrolling list cards, and sticky navigation.';
	}
	// 4. "Make product cards larger"
	else if (
		text.includes('larger') ||
		text.includes('bigger') ||
		text.includes('photo-forward') ||
		text.includes('grid')
	) {
		const oldLayout = next.theme.product_layout;
		next.theme.product_layout = 'grid';
		next.theme.card = 'elevated';
		next.theme.radius = 'lg';

		trackChange('Menu Layout', oldLayout, 'Grid (Large photo cards)');
		trackChange('Card Style', currentConfig.theme.card, 'Elevated');
		summary = 'Switched product display to photo-prominent Grid layout with elevated cards.';
	}
	// 5. "Create a clean bakery-style storefront"
	else if (text.includes('bakery') || text.includes('patisserie') || text.includes('pastry')) {
		next.store.business_type = 'BAKERY';
		next.theme.preset = 'fresh';
		next.theme.primary = '#b45309';
		next.theme.secondary = '#78350f';
		next.theme.accent = '#f59e0b';
		next.theme.font = 'poppins';
		next.theme.radius = 'lg';
		next.theme.button = 'rounded';
		next.theme.card = 'elevated';
		next.theme.hero = 'image';
		next.theme.hero_image_url =
			'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80';
		if (!next.store.tagline || next.store.tagline.includes('Momo')) {
			next.store.tagline = 'Artisan Sourdough & Freshly Baked Viennoiserie';
		}

		trackChange('Business Type', currentConfig.store.business_type, 'Bakery & Patisserie');
		trackChange('Primary Color', currentConfig.theme.primary, '#b45309 (Warm Amber / Crust)');
		trackChange('Typography', currentConfig.theme.font, 'Poppins (Friendly & Artisan)');
		trackChange('Hero Image', 'Standard', 'Artisan Bakery Cover Photo');
		summary = 'Created a warm bakery storefront with artisanal amber palette, Poppins typography, and morning bakery hero cover.';
	}
	// 6. "Juice bar / Fresh organic"
	else if (text.includes('juice') || text.includes('smoothie') || text.includes('organic') || text.includes('green')) {
		next.store.business_type = 'JUICE_BAR';
		next.theme.preset = 'fresh';
		next.theme.primary = '#059669';
		next.theme.secondary = '#0d9488';
		next.theme.accent = '#84cc16';
		next.theme.font = 'poppins';
		next.theme.radius = 'pill';
		next.theme.button = 'pill';
		next.theme.card = 'filled';
		next.theme.hero = 'gradient';

		trackChange('Business Type', currentConfig.store.business_type, 'Juice & Smoothie Bar');
		trackChange('Primary Color', currentConfig.theme.primary, '#059669 (Fresh Emerald)');
		trackChange('Button Style', currentConfig.theme.button, 'Pill');
		summary = 'Applied Fresh organic styling with emerald green palette, pill buttons, and soft filled cards.';
	}
	// 7. "Minimal / Boutique Retail"
	else if (text.includes('retail') || text.includes('boutique') || text.includes('minimal')) {
		next.store.business_type = 'RETAIL';
		next.theme.preset = 'minimal';
		next.theme.primary = '#111827';
		next.theme.secondary = '#4b5563';
		next.theme.accent = '#9ca3af';
		next.theme.font = 'sora';
		next.theme.radius = 'sm';
		next.theme.button = 'square';
		next.theme.card = 'outlined';
		next.theme.product_layout = 'grid';

		trackChange('Business Type', currentConfig.store.business_type, 'Retail & Boutique');
		trackChange('Theme Preset', currentConfig.theme.preset, 'Minimal');
		trackChange('Card Style', currentConfig.theme.card, 'Outlined');
		trackChange('Button Style', currentConfig.theme.button, 'Square');
		summary = 'Configured Minimalist retail aesthetic with sharp corners, outlined cards, and monochrome styling.';
	}
	// 8. Color requests: Blue / Ocean / Teal
	else if (text.includes('blue') || text.includes('ocean')) {
		next.theme.primary = '#2563eb';
		next.theme.secondary = '#1d4ed8';
		next.theme.accent = '#06b6d4';
		trackChange('Primary Color', currentConfig.theme.primary, '#2563eb');
		summary = 'Updated color scheme to Ocean Blue and Cyan accents.';
	}
	// 9. Color requests: Orange / Bold
	else if (text.includes('orange') || text.includes('bold')) {
		next.theme.preset = 'street-food';
		next.theme.primary = '#ea580c';
		next.theme.secondary = '#b91c1c';
		next.theme.accent = '#facc15';
		next.theme.radius = 'sm';
		trackChange('Theme Preset', currentConfig.theme.preset, 'Bold');
		trackChange('Primary Color', currentConfig.theme.primary, '#ea580c');
		summary = 'Set Bold high-energy preset with vibrant orange and sharp corners.';
	}
	// 10. Generic fallback: modern clean refresh
	else {
		next.theme.preset = 'modern';
		next.theme.radius = 'md';
		next.theme.card = 'elevated';
		trackChange('Theme Preset', currentConfig.theme.preset, 'Modern');
		summary = 'Applied a polished modern layout with balanced spacing and elevated cards.';
	}

	// Recompute client CSS vars for instant preview reactivity
	next.theme.vars = computeClientThemeVars(next.theme);

	return {
		prompt,
		summary,
		changes,
		updatedConfig: next
	};
}
