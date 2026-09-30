<script lang="ts">
	import { THEME_PRESETS } from '$lib/storefront/admin';

	let {
		value = '',
		onselect
	}: {
		value?: string;
		onselect?: (id: string) => void;
	} = $props();
</script>

<div class="onb-choices-grid onb-grid-3" role="radiogroup" aria-label="Select storefront theme preset">
	{#each THEME_PRESETS as preset (preset.id)}
		{@const isSelected = value === preset.id}
		<button
			type="button"
			role="radio"
			aria-checked={isSelected}
			class="onb-theme-card"
			class:is-selected={isSelected}
			onclick={() => onselect?.(preset.id)}
		>
			<!-- Top Right Radio Indicator -->
			<span class="onb-card-radio" aria-hidden="true">
				{#if isSelected}
					<span class="onb-radio-dot"></span>
				{/if}
			</span>

			<!-- Color Swatches Bar -->
			<div class="onb-theme-swatches">
				<span class="onb-theme-swatch" style:background={preset.primary} title={`Primary: ${preset.primary}`}></span>
				<span class="onb-theme-swatch" style:background={preset.secondary} title={`Secondary: ${preset.secondary}`}></span>
				<span class="onb-theme-swatch" style:background={preset.accent} title={`Accent: ${preset.accent}`}></span>
			</div>

			<div class="onb-theme-info">
				<span class="onb-theme-name">{preset.name}</span>
				<span class="onb-theme-blurb">{preset.blurb}</span>
			</div>
		</button>
	{/each}
</div>
