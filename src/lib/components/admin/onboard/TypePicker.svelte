<script lang="ts">
	import type { BusinessTypeTemplate } from '$lib/admin/businessTypes';
	import IconEye from '@tabler/icons-svelte/icons/eye';
	import IconEyeOff from '@tabler/icons-svelte/icons/eye-off';
	import { slide } from 'svelte/transition';

	let {
		templates = [] as BusinessTypeTemplate[],
		value = '',
		describedby = '',
		onselect
	}: {
		templates?: BusinessTypeTemplate[];
		value?: string;
		describedby?: string;
		onselect?: (code: string) => void;
	} = $props();

	let expandedInfo = $state<Record<string, boolean>>({});

	function toggleInfo(code: string, e: MouseEvent) {
		e.stopPropagation();
		expandedInfo[code] = !expandedInfo[code];
	}

	function handleKeydown(event: KeyboardEvent, index: number) {
		const count = templates.length;
		if (count === 0) return;
		let nextIndex = index;
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
			event.preventDefault();
			nextIndex = (index + 1) % count;
		} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
			event.preventDefault();
			nextIndex = (index - 1 + count) % count;
		} else if (event.key === ' ' || event.key === 'Enter') {
			event.preventDefault();
			const target = templates[index];
			if (target) onselect?.(target.code);
			return;
		}
		if (nextIndex !== index) {
			const target = templates[nextIndex];
			if (target) {
				onselect?.(target.code);
				const btn = document.getElementById(`type-card-${target.code}`);
				btn?.focus();
			}
		}
	}
</script>

{#if templates.length === 0}
	<p class="onb-field-hint">No business types are configured on this platform yet.</p>
{:else}
	<div
		class="onb-choices-grid onb-grid-3"
		role="radiogroup"
		aria-label="Select business type"
		aria-describedby={describedby || undefined}
	>
		{#each templates as template, i (template.code)}
			{@const isSelected = value === template.code}
			{@const isInfoOpen = !!expandedInfo[template.code]}
			{@const Icon = template.icon}
			<div
				id={`type-card-${template.code}`}
				role="radio"
				aria-checked={isSelected}
				class="onb-choice-card"
				class:is-selected={isSelected}
				class:has-info-open={isInfoOpen}
				tabindex={isSelected || (!value && i === 0) ? 0 : -1}
				onclick={() => onselect?.(template.code)}
				onkeydown={(e) => handleKeydown(e, i)}
			>
				<!-- Top Bar: Icon on Left, Eye Info Button + Radio Indicator on Right -->
				<div class="onb-card-topbar">
					<span class="onb-card-icon-box">
						<Icon size={20} stroke={1.8} />
					</span>

					<div class="onb-card-actions">
						<button
							type="button"
							class="onb-card-eye-btn"
							class:is-active={isInfoOpen}
							title={isInfoOpen ? 'Hide details' : 'Show more info'}
							aria-label={isInfoOpen ? 'Hide details' : 'Show more info'}
							onclick={(e) => toggleInfo(template.code, e)}
						>
							{#if isInfoOpen}
								<IconEyeOff size={14} stroke={2} />
							{:else}
								<IconEye size={14} stroke={2} />
							{/if}
						</button>

						<span class="onb-card-radio" aria-hidden="true">
							{#if isSelected}
								<span class="onb-radio-dot"></span>
							{/if}
						</span>
					</div>
				</div>

				<!-- Title and Summary Tagline -->
				<div class="onb-card-body">
					<span class="onb-card-title">{template.label}</span>
					<span class="onb-card-desc">{template.tagline}</span>
				</div>

				<!-- Expandable Detailed Info triggered by Eye Button -->
				{#if isInfoOpen}
					<div class="onb-card-more-info" transition:slide={{ duration: 150 }}>
						<p class="onb-card-detail-text">{template.description}</p>
						<div class="onb-card-meta-chips">
							<span class="onb-meta-chip">
								<span class="onb-meta-label">Catalog:</span> {template.terminology.catalog}
							</span>
							<span class="onb-meta-chip">
								<span class="onb-meta-label">Station:</span> {template.terminology.station}
							</span>
						</div>
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}
