<script lang="ts">
	import type { PlanOption } from '$lib/admin/types';
	import IconSparkles from '@tabler/icons-svelte/icons/sparkles';

	let {
		plans = [] as PlanOption[],
		value = '',
		describedby = '',
		onselect
	}: {
		plans?: PlanOption[];
		value?: string;
		describedby?: string;
		onselect?: (code: string) => void;
	} = $props();

	function priceLabel(plan: PlanOption): string {
		if (plan.price === 0) return 'Free';
		return `₹${plan.price.toLocaleString('en-IN')}`;
	}
</script>

<div
	class="onb-choices-grid onb-grid-2"
	role="radiogroup"
	aria-label="Select Plan"
	aria-describedby={describedby || undefined}
>
	{#each plans as plan (plan.code)}
		{@const isSelected = value === plan.code}
		<button
			type="button"
			role="radio"
			aria-checked={isSelected}
			class="onb-plan-card"
			class:is-selected={isSelected}
			onclick={() => onselect?.(plan.code)}
		>
			<!-- Top Right Radio Indicator -->
			<span class="onb-card-radio" aria-hidden="true">
				{#if isSelected}
					<span class="onb-radio-dot"></span>
				{/if}
			</span>

			<div class="onb-plan-head">
				<span class="onb-plan-name">{plan.label}</span>
				<span class="onb-plan-price" class:is-free={plan.price === 0}>
					{priceLabel(plan)}
				</span>
			</div>

			{#if plan.trialDays > 0}
				<span class="onb-plan-badge">
					<IconSparkles size={12} stroke={2} style="display:inline; margin-right:4px;" />
					{plan.trialDays}-day free trial
				</span>
			{/if}

			{#if plan.description}
				<span class="onb-card-desc">{plan.description}</span>
			{/if}
		</button>
	{/each}
</div>
