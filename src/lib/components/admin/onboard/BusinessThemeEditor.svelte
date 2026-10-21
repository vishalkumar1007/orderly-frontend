<script lang="ts">
	import Check from '@tabler/icons-svelte/icons/check';
	import { BUTTON_OPTIONS, FONT_OPTIONS, RADIUS_OPTIONS, THEME_PRESETS } from '$lib/storefront/admin';

	/**
	 * The business theme: how the storefront looks, and what the business's
	 * own console is seeded from. One editor, used twice: by the platform when
	 * onboarding a business, and by the owner under Settings, Business profile.
	 * Same choices in both places, so nothing set at onboarding is unreachable
	 * later.
	 *
	 * Deliberately short: a style to start from, brand colours, light or dark,
	 * and three shape choices. Everything finer lives in Customize.
	 */
	export type BusinessLook = {
		preset: string;
		mode: string;
		primary: string;
		secondary: string;
		accent: string;
		font: string;
		radius: string;
		button: string;
		card: string;
		hero: string;
	};

	let {
		look = $bindable(),
		onchange,
		disabled = false
	}: {
		look: BusinessLook;
		/** Called after any change, e.g. to mark a form dirty. */
		onchange?: () => void;
		disabled?: boolean;
	} = $props();

	/** Brand colour sets: primary, secondary and a highlight that sits well with both. */
	const PALETTES = [
		{ name: 'Crimson', primary: '#d7263d', secondary: '#8c1c2b', accent: '#f2b705' },
		{ name: 'Indigo', primary: '#5b4bdb', secondary: '#8b5cf6', accent: '#06b6d4' },
		{ name: 'Ocean', primary: '#0369a1', secondary: '#0e7490', accent: '#f59e0b' },
		{ name: 'Emerald', primary: '#059669', secondary: '#0d9488', accent: '#84cc16' },
		{ name: 'Saffron', primary: '#ea580c', secondary: '#b91c1c', accent: '#facc15' },
		{ name: 'Plum', primary: '#7c3aed', secondary: '#c026d3', accent: '#f472b6' },
		{ name: 'Rose', primary: '#e11d48', secondary: '#9f1239', accent: '#fb923c' },
		{ name: 'Charcoal', primary: '#111827', secondary: '#6b7280', accent: '#f59e0b' }
	];

	const MODES = [
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' },
		{ value: 'system', label: 'Follow device' }
	];

	const FONT_STACK: Record<string, string> = {
		inter: "'Inter', system-ui, sans-serif",
		sora: "'Sora', system-ui, sans-serif",
		poppins: "'Poppins', system-ui, sans-serif",
		system: 'system-ui, -apple-system, sans-serif'
	};

	const HEX = /^#[0-9a-fA-F]{6}$/;

	function touch() {
		onchange?.();
	}

	function pickPreset(id: string) {
		const p = THEME_PRESETS.find((x) => x.id === id);
		if (!p) return;
		look.preset = p.id;
		look.mode = p.mode;
		look.primary = p.primary;
		look.secondary = p.secondary;
		look.accent = p.accent;
		look.font = p.font;
		look.radius = p.radius;
		look.button = p.button_style;
		look.card = p.card_style;
		look.hero = p.hero_style;
		touch();
	}

	function pickPalette(p: (typeof PALETTES)[number]) {
		look.primary = p.primary;
		look.secondary = p.secondary;
		look.accent = p.accent;
		touch();
	}

	function setColour(key: 'primary' | 'secondary' | 'accent', value: string) {
		look[key] = value.trim();
		touch();
	}

	const activePalette = $derived(
		PALETTES.find(
			(p) =>
				p.primary.toLowerCase() === look.primary?.toLowerCase() &&
				p.secondary.toLowerCase() === look.secondary?.toLowerCase()
		)?.name ?? ''
	);

	const safe = (v: string, fallback: string) => (HEX.test(v ?? '') ? v : fallback);
</script>

<div class="bte">
	<div class="bte-controls">
		<section class="bte-block">
			<header>
				<span class="bte-step">1</span>
				<div>
					<h3>Style</h3>
					<p>A complete starting look. You can adjust colours and shape below.</p>
				</div>
			</header>
			<div class="bte-styles" role="radiogroup" aria-label="Style">
				{#each THEME_PRESETS as p (p.id)}
					{@const on = look.preset === p.id}
					<button type="button" class="bte-style" class:on role="radio" aria-checked={on} {disabled} onclick={() => pickPreset(p.id)}>
						<span class="bte-style-bar" aria-hidden="true">
							<i style:background={p.primary}></i>
							<i style:background={p.secondary}></i>
							<i style:background={p.accent}></i>
						</span>
						<span class="bte-style-name">
							{p.name}
							{#if on}<Check size={14} stroke={2.4} />{/if}
						</span>
						<span class="bte-style-blurb">{p.blurb}</span>
					</button>
				{/each}
			</div>
		</section>

		<section class="bte-block">
			<header>
				<span class="bte-step">2</span>
				<div>
					<h3>Brand colours</h3>
					<p>Pick a set, or enter your own. Primary colours buttons and the header.</p>
				</div>
			</header>
			<div class="bte-palettes" role="radiogroup" aria-label="Brand colours">
				{#each PALETTES as p (p.name)}
					{@const on = activePalette === p.name}
					<button type="button" class="bte-palette" class:on role="radio" aria-checked={on} {disabled} onclick={() => pickPalette(p)}>
						<span class="bte-palette-dots" aria-hidden="true">
							<i style:background={p.primary}></i>
							<i style:background={p.secondary}></i>
							<i style:background={p.accent}></i>
						</span>
						{p.name}
					</button>
				{/each}
			</div>
			<div class="bte-colours">
				{#each [{ key: 'primary', label: 'Primary' }, { key: 'secondary', label: 'Secondary' }, { key: 'accent', label: 'Highlight' }] as c (c.key)}
					{@const k = c.key as 'primary' | 'secondary' | 'accent'}
					<label class="bte-colour">
						<span class="bte-colour-label">{c.label}</span>
						<span class="bte-colour-row">
							<input
								type="color"
								class="bte-swatch"
								value={safe(look[k], '#000000')}
								{disabled}
								aria-label={`${c.label} colour`}
								oninput={(e) => setColour(k, e.currentTarget.value)}
							/>
							<input
								type="text"
								class="input bte-hex"
								value={look[k]}
								{disabled}
								spellcheck="false"
								aria-invalid={look[k] && !HEX.test(look[k]) ? 'true' : undefined}
								oninput={(e) => setColour(k, e.currentTarget.value)}
							/>
						</span>
					</label>
				{/each}
			</div>
		</section>

		<section class="bte-block">
			<header>
				<span class="bte-step">3</span>
				<div>
					<h3>Look and shape</h3>
					<p>Light or dark, the typeface, and how rounded things are.</p>
				</div>
			</header>
			<div class="bte-rows">
				<div class="bte-row">
					<span class="bte-row-label">Mode</span>
					<div class="bte-seg" role="radiogroup" aria-label="Mode">
						{#each MODES as m (m.value)}
							<button type="button" class:on={look.mode === m.value} role="radio" aria-checked={look.mode === m.value} {disabled} onclick={() => { look.mode = m.value; touch(); }}>{m.label}</button>
						{/each}
					</div>
				</div>
				<div class="bte-row">
					<span class="bte-row-label">Typeface</span>
					<div class="bte-seg" role="radiogroup" aria-label="Typeface">
						{#each FONT_OPTIONS as f (f.value)}
							<button type="button" style:font-family={FONT_STACK[f.value]} class:on={look.font === f.value} role="radio" aria-checked={look.font === f.value} {disabled} onclick={() => { look.font = f.value; touch(); }}>{f.label}</button>
						{/each}
					</div>
				</div>
				<div class="bte-row">
					<span class="bte-row-label">Corners</span>
					<div class="bte-seg" role="radiogroup" aria-label="Corners">
						{#each RADIUS_OPTIONS as r (r.value)}
							<button type="button" class:on={look.radius === r.value} role="radio" aria-checked={look.radius === r.value} {disabled} onclick={() => { look.radius = r.value; touch(); }}>{r.label}</button>
						{/each}
					</div>
				</div>
				<div class="bte-row">
					<span class="bte-row-label">Buttons</span>
					<div class="bte-seg" role="radiogroup" aria-label="Buttons">
						{#each BUTTON_OPTIONS as b (b.value)}
							<button type="button" class:on={look.button === b.value} role="radio" aria-checked={look.button === b.value} {disabled} onclick={() => { look.button = b.value; touch(); }}>{b.label}</button>
						{/each}
					</div>
				</div>
			</div>
		</section>
	</div>

</div>

<style>
	.bte {
		display: grid;
		gap: 1.25rem;
		align-items: start;
	}

	.bte-controls {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
	}

	.bte-block {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1rem 1.1rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--card-bg);
	}

	.bte-block header {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
	}

	.bte-step {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		flex: none;
		border-radius: 999px;
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: var(--accent);
		font-size: 0.75rem;
		font-weight: 700;
	}

	.bte-block h3 {
		margin: 0;
		font-size: var(--fs-body);
		font-weight: 650;
		color: var(--text);
	}

	.bte-block header p {
		margin: 0.15rem 0 0;
		font-size: var(--fs-meta);
		color: var(--text-3);
		line-height: 1.4;
	}

	.bte-styles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr));
		gap: 0.55rem;
	}

	.bte-style {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.6rem;
		border: 1.5px solid var(--border);
		border-radius: 10px;
		background: var(--surface-2);
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease;
	}

	.bte-style:hover:not(:disabled),
	.bte-palette:hover:not(:disabled) {
		border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
	}

	.bte-style.on,
	.bte-palette.on {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 8%, var(--surface));
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent);
	}

	.bte-style-bar {
		display: flex;
		height: 1.6rem;
		border-radius: 6px;
		overflow: hidden;
	}

	.bte-style-bar i {
		flex: 1;
	}

	.bte-style-name {
		display: inline-flex;
		align-items: center;
		justify-content: space-between;
		font-size: var(--fs-tab);
		font-weight: 650;
		color: var(--text);
	}

	.bte-style-name :global(svg) {
		color: var(--accent);
	}

	.bte-style-blurb {
		font-size: var(--fs-meta);
		color: var(--text-3);
		line-height: 1.35;
	}

	.bte-palettes {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.bte-palette {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.3rem 0.7rem 0.3rem 0.35rem;
		border: 1.5px solid var(--border);
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--text-2);
		font: inherit;
		font-size: var(--fs-tab);
		font-weight: 550;
		cursor: pointer;
	}

	.bte-palette-dots {
		display: inline-flex;
	}

	.bte-palette-dots i {
		width: 0.95rem;
		height: 0.95rem;
		border-radius: 999px;
		box-shadow: 0 0 0 2px var(--surface-2);
	}

	.bte-palette-dots i + i {
		margin-left: -0.3rem;
	}

	.bte-colours {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
		gap: 0.65rem;
	}

	.bte-colour {
		display: grid;
		gap: 0.3rem;
	}

	.bte-colour-label,
	.bte-row-label {
		font-size: var(--fs-meta);
		font-weight: 600;
		color: var(--text-2);
	}

	.bte-colour-row {
		display: flex;
		gap: 0.35rem;
	}

	.bte-swatch {
		width: 2.1rem;
		height: 2.1rem;
		flex: none;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: transparent;
		cursor: pointer;
		overflow: hidden;
	}

	.bte-swatch::-webkit-color-swatch-wrapper {
		padding: 0;
	}

	.bte-swatch::-webkit-color-swatch {
		border: none;
		border-radius: 6px;
	}

	.bte-hex {
		min-width: 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: var(--fs-tab);
	}

	.bte-rows {
		display: grid;
		gap: 0.7rem;
	}

	.bte-row {
		display: grid;
		gap: 0.35rem;
	}

	@media (min-width: 640px) {
		.bte-row {
			grid-template-columns: 6rem minmax(0, 1fr);
			align-items: center;
		}
	}

	.bte-seg {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 2px;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface-2);
		justify-self: start;
	}

	.bte-seg button {
		padding: 0.3rem 0.7rem;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: var(--text-2);
		font-size: var(--fs-tab);
		font-weight: 550;
		cursor: pointer;
	}

	.bte-seg button.on {
		background: var(--card-bg);
		color: var(--text);
		font-weight: 650;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
	}

</style>
