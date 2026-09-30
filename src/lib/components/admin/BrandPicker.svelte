<script lang="ts">
	import Monitor from '@lucide/svelte/icons/monitor';
	import Moon from '@lucide/svelte/icons/moon';
	import Sun from '@lucide/svelte/icons/sun';
	import CloudMoon from '@lucide/svelte/icons/cloud-moon';
	import CloudSun from '@lucide/svelte/icons/cloud-sun';
	import Cloud from '@lucide/svelte/icons/cloud';
	import Contrast from '@lucide/svelte/icons/contrast';
	import Circle from '@lucide/svelte/icons/circle';
	import MoonStar from '@lucide/svelte/icons/moon-star';
	import type { ThemePreset } from '$lib/brandTheme';
	import { COLOR_MODES, type ColorMode } from '$lib/appearance.svelte';
	import type { Component } from 'svelte';

	let {
		presets = [] as ThemePreset[],
		presetId = $bindable('indigo-violet'),
		colorMode = $bindable<ColorMode>('system'),
		accent = $bindable(''),
		accent2 = $bindable(''),
		accentError = '',
		accent2Error = '',
		disabled = false
	}: {
		presets?: ThemePreset[];
		presetId?: string;
		colorMode?: ColorMode;
		accent?: string;
		accent2?: string;
		accentError?: string;
		accent2Error?: string;
		disabled?: boolean;
	} = $props();

	const selected = $derived(presets.find((p) => p.id === presetId) ?? presets[0]);
	const primary = $derived(accent.trim() || selected?.tokens.accent || '#4f46e5');
	const secondary = $derived(
		accent2.trim() || selected?.tokens.accent2 || selected?.tokens.accent || '#4f46e5'
	);

	const QUICK_COLOURS: Array<{ name: string; accent: string; accent2: string }> = [
		{ name: 'Indigo', accent: '#4f46e5', accent2: '#6366f1' },
		{ name: 'Blue', accent: '#2563eb', accent2: '#3b82f6' },
		{ name: 'Sky', accent: '#0284c7', accent2: '#0ea5e9' },
		{ name: 'Teal', accent: '#0d9488', accent2: '#14b8a6' },
		{ name: 'Emerald', accent: '#059669', accent2: '#10b981' },
		{ name: 'Lime', accent: '#65a30d', accent2: '#84cc16' },
		{ name: 'Amber', accent: '#d97706', accent2: '#f59e0b' },
		{ name: 'Orange', accent: '#ea580c', accent2: '#f97316' },
		{ name: 'Rose', accent: '#e11d48', accent2: '#f43f5e' },
		{ name: 'Pink', accent: '#db2777', accent2: '#ec4899' },
		{ name: 'Violet', accent: '#7c3aed', accent2: '#a78bfa' },
		{ name: 'Slate', accent: '#475569', accent2: '#64748b' }
	];

	const activeQuick = $derived(
		QUICK_COLOURS.find((c) => c.accent.toLowerCase() === primary.toLowerCase())?.accent ?? ''
	);

	const MODE_ICONS: Record<ColorMode, Component> = {
		light: Sun,
		soft: CloudSun,
		mist: Cloud,
		dark: Moon,
		graphite: Circle,
		raw: Contrast,
		night: CloudMoon,
		midnight: MoonStar,
		system: Monitor
	};

	/** Preview wash for each dashboard look using the active quick colour. */
	function modeSwatch(id: ColorMode): string {
		const a = primary;
		const a2 = secondary;
		switch (id) {
			case 'light':
				return `linear-gradient(145deg, color-mix(in srgb, ${a} 7%, #f7f8fb), #fff 60%)`;
			case 'soft':
				return `linear-gradient(145deg, color-mix(in srgb, ${a} 18%, #f3f1ec), color-mix(in srgb, ${a2} 10%, #fffcf7))`;
			case 'mist':
				return `linear-gradient(145deg, color-mix(in srgb, ${a} 5%, #f1f4f8), #f8fafc 70%)`;
			case 'dark':
				return `linear-gradient(145deg, color-mix(in srgb, ${a} 20%, #08090f), #10121d 60%)`;
			case 'graphite':
				return `linear-gradient(145deg, #0c0c0e, #1a1a1d)`;
			case 'raw':
				return `linear-gradient(145deg, #000, #111)`;
			case 'night':
				return `linear-gradient(145deg, color-mix(in srgb, ${a} 22%, #0a0a0b), color-mix(in srgb, ${a2} 12%, #18181b))`;
			case 'midnight':
				return `linear-gradient(145deg, color-mix(in srgb, ${a} 16%, #0b1220), #0f172a 55%)`;
			default:
				return `linear-gradient(135deg, #f7f8fb 50%, #10121d 50%)`;
		}
	}
</script>

<div class="theme-picker">
	<div class="theme-controls">
		<div class="theme-field theme-field-wide">
			<span class="theme-field-label" id="mode-label">Dashboard look</span>
			<p class="field-hint" style="margin:0 0 0.55rem;">
				Full console background. Soft / Night / Midnight tint from Quick colours; Graphite &amp; Raw stay flat.
			</p>
			<div class="mode-cards" role="radiogroup" aria-labelledby="mode-label">
				{#each COLOR_MODES as m (m.id)}
					{@const Icon = MODE_ICONS[m.id]}
					<button
						type="button"
						class="mode-card"
						class:active={colorMode === m.id}
						role="radio"
						aria-checked={colorMode === m.id}
						{disabled}
						onclick={() => (colorMode = m.id)}
					>
						<span class="mode-card-swatch" style:background={modeSwatch(m.id)} aria-hidden="true">
							{#if m.wash !== 'none' && m.id !== 'system'}
								<span class="mode-card-wash-tag">{m.wash}</span>
							{:else if m.wash === 'none'}
								<span class="mode-card-wash-tag flat">flat</span>
							{/if}
						</span>
						<span class="mode-card-meta">
							<span class="mode-card-title">
								<Icon size={13} strokeWidth={2.1} />
								{m.label}
							</span>
							<span class="mode-card-hint">{m.hint}</span>
						</span>
					</button>
				{/each}
			</div>
		</div>

		<div class="theme-field theme-field-wide">
			<span class="theme-field-label" id="quick-label">Quick colours</span>
			<p class="field-hint" style="margin:0 0 0.45rem;">
				Accent colour for buttons, rail highlights, and the dashboard background wash.
			</p>
			<div class="quick-row" role="radiogroup" aria-labelledby="quick-label">
				{#each QUICK_COLOURS as choice (choice.accent)}
					{@const on = activeQuick === choice.accent}
					<button
						type="button"
						class="quick-dot"
						class:on
						role="radio"
						aria-checked={on}
						aria-label={choice.name}
						title={choice.name}
						{disabled}
						style:background={choice.accent}
						onclick={() => {
							accent = choice.accent;
							accent2 = choice.accent2;
						}}
					></button>
				{/each}
			</div>
		</div>

		<div class="theme-field">
			<label class="theme-field-label" for="brand-primary">Primary colour</label>
			<div class="accent-row">
				<input
					class="accent-swatch"
					type="color"
					value={primary}
					disabled={disabled}
					aria-label="Pick primary colour"
					oninput={(e) => (accent = e.currentTarget.value)}
				/>
				<input
					id="brand-primary"
					class="input mono"
					type="text"
					placeholder={selected?.tokens.accent || '#4f46e5'}
					value={accent}
					disabled={disabled}
					spellcheck="false"
					aria-invalid={accentError ? 'true' : undefined}
					oninput={(e) => (accent = e.currentTarget.value)}
				/>
			</div>
			{#if accentError}
				<p class="field-error">{accentError}</p>
			{/if}
		</div>

		<div class="theme-field">
			<label class="theme-field-label" for="brand-secondary">Secondary colour</label>
			<div class="accent-row">
				<input
					class="accent-swatch"
					type="color"
					value={secondary}
					disabled={disabled}
					aria-label="Pick secondary colour"
					oninput={(e) => (accent2 = e.currentTarget.value)}
				/>
				<input
					id="brand-secondary"
					class="input mono"
					type="text"
					placeholder={selected?.tokens.accent2 || '#1d3557'}
					value={accent2}
					disabled={disabled}
					spellcheck="false"
					aria-invalid={accent2Error ? 'true' : undefined}
					oninput={(e) => (accent2 = e.currentTarget.value)}
				/>
			</div>
			{#if accent2Error}
				<p class="field-error">{accent2Error}</p>
			{/if}
		</div>
	</div>

	{#if accent.trim() || accent2.trim()}
		<button
			type="button"
			class="btn btn-quiet btn-sm"
			style="margin-top:0.75rem;"
			{disabled}
			onclick={() => {
				accent = '';
				accent2 = '';
			}}
		>
			Reset to default colours
		</button>
	{/if}
</div>

<style>
	.theme-picker {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.theme-controls {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem 1.25rem;
	}

	.theme-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 0;
	}

	.theme-field-wide {
		grid-column: 1 / -1;
	}

	.theme-field-label {
		font-size: var(--fs-code);
		font-weight: 600;
		color: var(--text-2);
	}

	.field-hint {
		margin: 0;
		font-size: var(--fs-meta);
		color: var(--text-3);
		line-height: 1.4;
	}

	.field-error {
		margin: 0;
		font-size: var(--fs-meta);
		color: var(--danger);
	}

	.mode-cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
		gap: 0.55rem;
	}

	.mode-card {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		padding: 0.45rem;
		border: 1.5px solid var(--border);
		border-radius: 10px;
		background: var(--surface-2);
		text-align: left;
		cursor: pointer;
		font: inherit;
		color: inherit;
		transition:
			border-color 0.15s ease,
			background 0.15s ease,
			box-shadow 0.15s ease;
	}

	.mode-card:hover:not(:disabled) {
		border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
	}

	.mode-card.active {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 8%, var(--surface));
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 22%, transparent);
	}

	.mode-card-swatch {
		display: block;
		position: relative;
		height: 2.75rem;
		border-radius: 7px;
		border: 1px solid var(--border-subtle, var(--border));
		overflow: hidden;
	}

	.mode-card-wash-tag {
		position: absolute;
		right: 0.35rem;
		bottom: 0.3rem;
		padding: 0.1rem 0.35rem;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.45);
		color: #fff;
		font-size: 0.625rem;
		font-weight: 650;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.mode-card-wash-tag.flat {
		background: rgba(255, 255, 255, 0.14);
	}

	.mode-card-meta {
		display: grid;
		gap: 0.1rem;
		padding: 0 0.15rem 0.15rem;
	}

	.mode-card-title {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: var(--fs-tab);
		font-weight: 650;
		color: var(--text);
	}

	.mode-card-hint {
		font-size: var(--fs-meta);
		color: var(--text-3);
		line-height: 1.35;
	}

	.quick-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.quick-dot {
		width: 1.65rem;
		height: 1.65rem;
		border-radius: 999px;
		border: 2px solid transparent;
		cursor: pointer;
		padding: 0;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
		transition: transform 0.12s ease, box-shadow 0.12s ease;
	}

	.quick-dot:hover:not(:disabled) {
		transform: scale(1.08);
	}

	.quick-dot.on {
		box-shadow:
			0 0 0 2px var(--surface),
			0 0 0 4px var(--accent);
	}

	.accent-row {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}

	.accent-swatch {
		width: 2.1rem;
		height: 2.1rem;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: transparent;
		cursor: pointer;
		overflow: hidden;
	}

	.accent-swatch::-webkit-color-swatch-wrapper {
		padding: 0;
	}

	.accent-swatch::-webkit-color-swatch {
		border: none;
		border-radius: 6px;
	}

	.mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: var(--fs-tab);
	}

	@media (max-width: 720px) {
		.theme-controls {
			grid-template-columns: 1fr;
		}
	}
</style>
