<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Monitor from '@lucide/svelte/icons/monitor';
	import Moon from '@lucide/svelte/icons/moon';
	import Sun from '@lucide/svelte/icons/sun';
	import type { ThemePreset } from '$lib/brandTheme';

	let {
		presets = [] as ThemePreset[],
		presetId = $bindable('indigo-violet'),
		colorMode = $bindable<'light' | 'dark' | 'system'>('system'),
		accent = $bindable(''),
		accent2 = $bindable(''),
		accentError = '',
		accent2Error = '',
		disabled = false
	}: {
		presets?: ThemePreset[];
		presetId?: string;
		colorMode?: 'light' | 'dark' | 'system';
		/** Primary colour override. Blank inherits the preset's accent. */
		accent?: string;
		/** Secondary colour override. Blank inherits the preset's accent2. */
		accent2?: string;
		/** Validation message for the primary override, if any. */
		accentError?: string;
		/** Validation message for the secondary override, if any. */
		accent2Error?: string;
		disabled?: boolean;
	} = $props();

	const selected = $derived(presets.find((p) => p.id === presetId) ?? presets[0]);
	const primary = $derived(accent.trim() || selected?.tokens.accent || '#4f46e5');
	const secondary = $derived(accent2.trim() || selected?.tokens.accent2 || selected?.tokens.accent || '#4f46e5');

	const MODES = [
		{ id: 'light', label: 'Light', icon: Sun },
		{ id: 'dark', label: 'Dark', icon: Moon },
		{ id: 'system', label: 'System', icon: Monitor }
	] as const;
</script>

<div class="theme-picker">
	<!-- Preset gallery: each card previews the real storefront chrome -->
	<div class="theme-grid" role="radiogroup" aria-label="Brand theme">
		{#each presets as preset (preset.id)}
			{@const isSel = presetId === preset.id}
			<button
				type="button"
				class={['theme-card', isSel ? 'selected' : ''].join(' ')}
				role="radio"
				aria-checked={isSel}
				{disabled}
				onclick={() => {
					presetId = preset.id;
					accent = '';
					accent2 = '';
				}}
			>
				<span class="theme-shot" style:--a={preset.tokens.accent} style:--a2={preset.tokens.accent2} aria-hidden="true">
					<span class="theme-shot-bar"></span>
					<span class="theme-shot-row">
						<i></i><i></i><i></i>
					</span>
					<span class="theme-shot-cta"></span>
				</span>

				<span class="theme-card-foot">
					<span class="theme-card-name">{preset.name}</span>
					{#if isSel}
						<span class="theme-check" aria-hidden="true"><Check size={11} strokeWidth={3} /></span>
					{/if}
				</span>
				<span class="theme-dots" aria-hidden="true">
					<i style:background={preset.tokens.accent}></i>
					<i style:background={preset.tokens.accent2}></i>
				</span>
			</button>
		{/each}
	</div>

	<!-- Colour mode + primary/secondary overrides -->
	<div class="theme-controls">
		<div class="theme-field">
			<span class="theme-field-label" id="mode-label">Theme mode</span>
			<div class="mode-seg" role="radiogroup" aria-labelledby="mode-label">
				{#each MODES as m (m.id)}
					{@const Icon = m.icon}
					<button
						type="button"
						class={colorMode === m.id ? 'active' : ''}
						role="radio"
						aria-checked={colorMode === m.id}
						{disabled}
						onclick={() => (colorMode = m.id)}
					>
						<Icon size={13} strokeWidth={2} />
						{m.label}
					</button>
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
			{:else}
				<p class="field-hint">Leave blank to use the preset colour.</p>
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
			{:else}
				<p class="field-hint">Leave blank to use the preset colour.</p>
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
			Reset to preset colours
		</button>
	{/if}
</div>

<style>
	.theme-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
		gap: 0.6rem;
	}

	.theme-card {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		padding: 0.5rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text);
		font-family: inherit;
		text-align: left;
		cursor: pointer;
		transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
	}

	.theme-card:hover:not(:disabled) {
		border-color: color-mix(in srgb, var(--a, var(--accent)) 45%, var(--border));
	}

	.theme-card:active:not(:disabled) {
		transform: scale(0.985);
	}

	.theme-card.selected {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent);
	}

	.theme-card:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	/* Mini storefront preview */
	.theme-shot {
		display: block;
		border-radius: 7px;
		border: 1px solid var(--border-subtle);
		background: var(--surface-2);
		overflow: hidden;
	}

	.theme-shot-bar {
		display: block;
		height: 1.05rem;
		background: linear-gradient(90deg, var(--a), var(--a2));
	}

	.theme-shot-row {
		display: flex;
		gap: 0.2rem;
		padding: 0.4rem 0.4rem 0.3rem;
	}

	.theme-shot-row i {
		flex: 1;
		height: 1.35rem;
		border-radius: 3px;
		background: var(--surface-3);
		border: 1px solid var(--border-subtle);
	}

	.theme-shot-cta {
		display: block;
		height: 0.5rem;
		width: 45%;
		margin: 0 0.4rem 0.45rem;
		border-radius: 3px;
		background: var(--a);
	}

	.theme-card-foot {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.theme-card-name {
		font-size: 0.8rem;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.theme-check {
		margin-left: auto;
		width: 1.05rem;
		height: 1.05rem;
		flex-shrink: 0;
		display: grid;
		place-items: center;
		border-radius: 999px;
		background: var(--accent);
		color: #fff;
	}

	.theme-dots {
		display: flex;
		gap: 0.25rem;
	}

	.theme-dots i {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 999px;
	}

	.theme-controls {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
		gap: 0.9rem;
		margin-top: 1.1rem;
		padding-top: 1.1rem;
		border-top: 1px solid var(--border);
		align-items: end;
	}

	.theme-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 0;
	}

	.theme-field-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-2);
	}

	.mode-seg {
		display: inline-flex;
		padding: 0.15rem;
		gap: 0.15rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface-2);
	}

	.mode-seg button {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.32rem 0.55rem;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--text-3);
		font-family: inherit;
		font-size: 0.78rem;
		font-weight: 550;
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease;
	}

	.mode-seg button:hover:not(:disabled) {
		color: var(--text);
	}

	.mode-seg button.active {
		background: var(--surface);
		color: var(--text);
		box-shadow: var(--shadow-sm);
	}

	.accent-row {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}

	.accent-swatch {
		width: 2.3rem;
		height: 2.3rem;
		flex-shrink: 0;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: transparent;
		cursor: pointer;
	}
</style>
