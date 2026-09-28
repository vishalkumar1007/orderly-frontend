<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import {
		BUTTON_OPTIONS,
		CARD_OPTIONS,
		FILTER_OPTIONS,
		FONT_OPTIONS,
		HERO_OPTIONS,
		LAYOUT_OPTIONS,
		MODE_OPTIONS,
		RADIUS_OPTIONS,
		THEME_PRESETS,
		type ThemePreset
	} from '$lib/storefront/admin';

	/**
	 * The storefront theme, as a control rather than a screen.
	 *
	 * This draws from exactly the same preset and option catalogues the
	 * business's own Customize → Theme screen uses, so what an operator picks
	 * while onboarding is what the owner later sees they have. Two separate
	 * lists would drift within a release, and the owner would open their theme
	 * screen to find a preset that does not exist.
	 *
	 * It owns no state and calls no API: the caller holds the values and
	 * decides what saving means. Onboarding sends them with the new business;
	 * the tenant screen PUTs them to its own storefront.
	 */

	let {
		preset = $bindable('modern'),
		mode = $bindable('light'),
		primary = $bindable('#5b4bdb'),
		secondary = $bindable('#8b5cf6'),
		accent = $bindable('#06b6d4'),
		font = $bindable('inter'),
		radius = $bindable('lg'),
		button = $bindable('soft'),
		card = $bindable('elevated'),
		hero = $bindable('gradient'),
		layout = $bindable('grid'),
		filterStyle = $bindable('chips'),
		/** Shown in the preview so the sample reads as this business. */
		storeName = 'Your shop',
		/** Hides the finer controls until asked for, to keep onboarding short. */
		compact = false
	}: {
		preset?: string;
		mode?: string;
		primary?: string;
		secondary?: string;
		accent?: string;
		font?: string;
		radius?: string;
		button?: string;
		card?: string;
		hero?: string;
		layout?: string;
		filterStyle?: string;
		storeName?: string;
		compact?: boolean;
	} = $props();

	// Expanded by default; `compact` starts it closed for onboarding, where the
	// step should be short. Tracked separately so opening it sticks.
	let expanded = $state(false);
	const showDetails = $derived(expanded || !compact);

	/**
	 * Choosing a preset replaces the lot.
	 *
	 * A preset is a whole look, not a starting colour: keeping a previous
	 * font or radius would produce something that is neither preset, which is
	 * how themed products end up looking broken.
	 */
	function selectPreset(option: ThemePreset) {
		preset = option.id;
		primary = option.primary;
		secondary = option.secondary;
		accent = option.accent;
		font = option.font;
		radius = option.radius;
		button = option.button_style;
		card = option.card_style;
		hero = option.hero_style;
		mode = option.mode;
	}

	const RADIUS_PX: Record<string, string> = {
		none: '0px',
		sm: '6px',
		md: '10px',
		lg: '16px',
		pill: '999px'
	};

	const FONT_STACK: Record<string, string> = {
		inter: "'Inter', system-ui, sans-serif",
		sora: "'Sora', 'Inter', sans-serif",
		poppins: "'Poppins', 'Inter', sans-serif",
		system: 'system-ui, -apple-system, sans-serif'
	};

	const dark = $derived(mode === 'dark');
	const previewStyle = $derived(
		[
			`--pv-primary:${primary}`,
			`--pv-secondary:${secondary}`,
			`--pv-accent:${accent}`,
			`--pv-radius:${RADIUS_PX[radius] ?? '10px'}`,
			`--pv-font:${FONT_STACK[font] ?? FONT_STACK.inter}`,
			`--pv-btn-radius:${button === 'pill' ? '999px' : button === 'square' ? '0px' : RADIUS_PX[radius] ?? '10px'}`
		].join(';')
	);
</script>

<div class="tp">
	<div class="tp-controls">
		<div class="tp-block">
			<p class="field-label">Starting look</p>
			<div class="tp-presets" role="radiogroup" aria-label="Theme preset">
				{#each THEME_PRESETS as option (option.id)}
					<button
						type="button"
						class={['tp-preset', preset === option.id ? 'selected' : ''].join(' ')}
						role="radio"
						aria-checked={preset === option.id}
						onclick={() => selectPreset(option)}
					>
						<span class="tp-swatches" aria-hidden="true">
							<i style={`background:${option.primary};`}></i>
							<i style={`background:${option.secondary};`}></i>
							<i style={`background:${option.accent};`}></i>
						</span>
						<span class="tp-preset-txt">
							<strong>{option.name}</strong>
							<span>{option.blurb}</span>
						</span>
						{#if preset === option.id}
							<span class="tp-check" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>
						{/if}
					</button>
				{/each}
			</div>
		</div>

		<div class="tp-block">
			<p class="field-label">Colours</p>
			<div class="tp-colours">
				{#each [{ id: 'primary', label: 'Primary' }, { id: 'secondary', label: 'Secondary' }, { id: 'accent', label: 'Accent' }] as swatch (swatch.id)}
					<label class="tp-colour">
						<span>{swatch.label}</span>
						<input
							type="color"
							value={swatch.id === 'primary' ? primary : swatch.id === 'secondary' ? secondary : accent}
							oninput={(e) => {
								const value = (e.currentTarget as HTMLInputElement).value;
								if (swatch.id === 'primary') primary = value;
								else if (swatch.id === 'secondary') secondary = value;
								else accent = value;
							}}
						/>
						<code class="mono">
							{(swatch.id === 'primary' ? primary : swatch.id === 'secondary' ? secondary : accent).toUpperCase()}
						</code>
					</label>
				{/each}
			</div>
		</div>

		<div class="tp-block">
			<p class="field-label">Light or dark</p>
			<div class="mode-seg" role="radiogroup" aria-label="Colour mode">
				{#each MODE_OPTIONS as option (option.value)}
					<button
						type="button"
						class={mode === option.value ? 'active' : ''}
						role="radio"
						aria-checked={mode === option.value}
						onclick={() => (mode = option.value)}
					>
						{option.label}
					</button>
				{/each}
			</div>
		</div>

		<div class="tp-block">
			<p class="field-label">Menu layout</p>
			<div class="tp-layouts" role="radiogroup" aria-label="Menu layout">
				{#each LAYOUT_OPTIONS as option (option.value)}
					<button
						type="button"
						class={['tp-layout', layout === option.value ? 'selected' : ''].join(' ')}
						role="radio"
						aria-checked={layout === option.value}
						onclick={() => (layout = option.value)}
					>
						<strong>{option.label}</strong>
						<span>{option.hint}</span>
					</button>
				{/each}
			</div>
		</div>

		{#if compact && !showDetails}
			<button type="button" class="btn btn-quiet btn-sm" onclick={() => (expanded = true)}>
				More options — fonts, corners, cards
			</button>
		{/if}

		{#if showDetails}
			<div class="tp-block">
				<p class="field-label">Details</p>
				<div class="tp-selects">
					<label class="field">
						<span class="field-label">Font</span>
						<select class="input" bind:value={font}>
							{#each FONT_OPTIONS as option (option.value)}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</label>
					<label class="field">
						<span class="field-label">Corners</span>
						<select class="input" bind:value={radius}>
							{#each RADIUS_OPTIONS as option (option.value)}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</label>
					<label class="field">
						<span class="field-label">Buttons</span>
						<select class="input" bind:value={button}>
							{#each BUTTON_OPTIONS as option (option.value)}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</label>
					<label class="field">
						<span class="field-label">Cards</span>
						<select class="input" bind:value={card}>
							{#each CARD_OPTIONS as option (option.value)}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</label>
					<label class="field">
						<span class="field-label">Hero</span>
						<select class="input" bind:value={hero}>
							{#each HERO_OPTIONS as option (option.value)}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</label>
					<label class="field">
						<span class="field-label">Filters</span>
						<select class="input" bind:value={filterStyle}>
							{#each FILTER_OPTIONS as option (option.value)}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</label>
				</div>
			</div>
		{/if}
	</div>

	<aside class="tp-preview" aria-label="Storefront preview">
		<p class="field-label">Preview</p>
		<div class={['pv', dark ? 'pv-dark' : ''].join(' ')} style={previewStyle}>
			<div class="pv-head" data-hero={hero}>
				<span class="pv-name">{storeName}</span>
				<span class="pv-cart">Cart</span>
			</div>
			<div class="pv-filters" data-style={filterStyle}>
				<span class="on">All</span><span>Popular</span><span>New</span>
			</div>
			<div class="pv-items" data-layout={layout}>
				{#each [1, 2, 3, 4] as i (i)}
					<div class="pv-item" data-card={card}>
						<span class="pv-thumb"></span>
						<span class="pv-lines">
							<i class="wide"></i>
							<i></i>
						</span>
						<span class="pv-price">₹120</span>
					</div>
				{/each}
			</div>
			<div class="pv-cta">Add to cart</div>
		</div>
		<p class="tp-note">
			The owner can change all of this later from their own Customize screen.
		</p>
	</aside>
</div>

<style>
	.tp {
		display: grid;
		gap: 1.5rem;
		align-items: start;
	}

	@media (min-width: 1040px) {
		.tp {
			grid-template-columns: minmax(0, 1fr) 17rem;
		}
	}

	.tp-controls {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		min-width: 0;
	}

	.tp-presets {
		display: grid;
		gap: 0.5rem;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
		margin-top: 0.5rem;
	}

	.tp-preset {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.65rem 0.7rem;
		border: 1.5px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		cursor: pointer;
		text-align: left;
		font-family: inherit;
		transition:
			border-color var(--tr),
			background var(--tr);
	}

	.tp-preset:hover {
		border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
	}

	.tp-preset.selected {
		border-color: var(--accent);
		background: var(--accent-soft);
	}

	.tp-swatches {
		display: flex;
		flex-shrink: 0;
	}

	.tp-swatches i {
		width: 0.85rem;
		height: 1.6rem;
		border: 1px solid rgba(0, 0, 0, 0.08);
	}

	.tp-swatches i:first-child {
		border-radius: 5px 0 0 5px;
	}

	.tp-swatches i:last-child {
		border-radius: 0 5px 5px 0;
	}

	.tp-preset-txt {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.tp-preset-txt strong {
		font-size: 0.84rem;
		font-weight: 600;
	}

	.tp-preset-txt span {
		font-size: 0.72rem;
		color: var(--text-3);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tp-check {
		position: absolute;
		top: 0.45rem;
		right: 0.45rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.05rem;
		height: 1.05rem;
		border-radius: 999px;
		background: var(--accent);
		color: var(--on-accent);
	}

	.tp-colours {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}

	.tp-colour {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.78rem;
		color: var(--text-2);
	}

	.tp-colour input[type='color'] {
		width: 2.1rem;
		height: 2rem;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		cursor: pointer;
	}

	.tp-colour code {
		font-size: 0.7rem;
		color: var(--text-3);
	}

	.tp-layouts {
		display: grid;
		gap: 0.5rem;
		grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
		margin-top: 0.5rem;
	}

	.tp-layout {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.6rem 0.7rem;
		border: 1.5px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		text-align: left;
		font-family: inherit;
		cursor: pointer;
	}

	.tp-layout.selected {
		border-color: var(--accent);
		background: var(--accent-soft);
	}

	.tp-layout strong {
		font-size: 0.82rem;
		font-weight: 600;
	}

	.tp-layout span {
		font-size: 0.72rem;
		color: var(--text-3);
	}

	.tp-selects {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		margin-top: 0.5rem;
	}

	/* ---------- preview ---------- */

	.tp-preview {
		position: sticky;
		top: calc(var(--topbar-h) + 1rem);
	}

	.pv {
		margin-top: 0.5rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
		background: #fff;
		color: #121212;
		font-family: var(--pv-font);
	}

	.pv-dark {
		background: #14161d;
		color: #f2f4f8;
		border-color: #262b38;
	}

	.pv-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.7rem 0.75rem;
		background: var(--pv-primary);
		color: #fff;
	}

	.pv-head[data-hero='gradient'] {
		background: linear-gradient(120deg, var(--pv-primary), var(--pv-secondary));
	}

	.pv-head[data-hero='compact'] {
		padding: 0.5rem 0.75rem;
	}

	.pv-head[data-hero='none'] {
		background: transparent;
		color: inherit;
		border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent);
	}

	.pv-name {
		font-size: 0.82rem;
		font-weight: 700;
	}

	.pv-cart {
		font-size: 0.68rem;
		opacity: 0.85;
	}

	.pv-filters {
		display: flex;
		gap: 0.3rem;
		padding: 0.55rem 0.75rem 0;
	}

	.pv-filters span {
		font-size: 0.62rem;
		padding: 0.15rem 0.45rem;
		border-radius: 999px;
		background: color-mix(in srgb, currentColor 8%, transparent);
	}

	.pv-filters[data-style='rail'] span {
		border-radius: 0;
		background: transparent;
		border-bottom: 2px solid transparent;
	}

	.pv-filters span.on {
		background: var(--pv-accent);
		color: #fff;
	}

	.pv-filters[data-style='rail'] span.on {
		background: transparent;
		color: var(--pv-primary);
		border-bottom-color: var(--pv-primary);
	}

	.pv-items {
		display: grid;
		gap: 0.4rem;
		padding: 0.6rem 0.75rem;
	}

	.pv-items[data-layout='grid'] {
		grid-template-columns: 1fr 1fr;
	}

	.pv-items[data-layout='compact'] .pv-thumb {
		width: 1.1rem;
		height: 1.1rem;
	}

	.pv-item {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem;
		border-radius: var(--pv-radius);
		background: color-mix(in srgb, currentColor 5%, transparent);
	}

	.pv-item[data-card='outlined'] {
		background: transparent;
		border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
	}

	.pv-item[data-card='elevated'] {
		background: color-mix(in srgb, currentColor 4%, transparent);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
	}

	.pv-item[data-card='minimal'] {
		background: transparent;
		padding-left: 0;
		padding-right: 0;
	}

	.pv-items[data-layout='grid'] .pv-item {
		flex-direction: column;
		align-items: flex-start;
	}

	.pv-thumb {
		width: 1.6rem;
		height: 1.6rem;
		border-radius: calc(var(--pv-radius) / 1.6);
		background: color-mix(in srgb, var(--pv-secondary) 45%, transparent);
		flex-shrink: 0;
	}

	.pv-items[data-layout='grid'] .pv-thumb {
		width: 100%;
		height: 2.1rem;
	}

	.pv-lines {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		flex: 1;
		min-width: 0;
		width: 100%;
	}

	.pv-lines i {
		height: 0.3rem;
		border-radius: 999px;
		background: color-mix(in srgb, currentColor 18%, transparent);
		width: 55%;
	}

	.pv-lines i.wide {
		width: 85%;
	}

	.pv-price {
		font-size: 0.66rem;
		font-weight: 700;
		color: var(--pv-primary);
	}

	.pv-dark .pv-price {
		color: var(--pv-accent);
	}

	.pv-cta {
		margin: 0 0.75rem 0.75rem;
		padding: 0.45rem;
		text-align: center;
		border-radius: var(--pv-btn-radius);
		background: var(--pv-primary);
		color: #fff;
		font-size: 0.7rem;
		font-weight: 700;
	}

	.tp-note {
		margin: 0.6rem 0 0;
		font-size: 0.72rem;
		line-height: 1.5;
		color: var(--text-3);
	}
</style>
