<script lang="ts">
	type Step = { id: string; label: string; description?: string };

	let {
		steps = [] as Step[],
		current = 0,
		onSelect
	}: {
		steps?: Step[];
		current?: number;
		onSelect?: (index: number) => void;
	} = $props();

	function handleSelect(i: number) {
		if (i <= current && onSelect) {
			onSelect(i);
		}
	}
</script>

<div class="onb-progress-wrap" aria-label="Onboarding progress">
	<!-- Segmented progress bar (matching IdeaPilot AI style from screenshot) -->
	<div class="onb-segments-bar" role="progressbar" aria-valuenow={current + 1} aria-valuemin={1} aria-valuemax={steps.length}>
		{#each steps as s, i (s.id)}
			{@const isActive = i === current}
			{@const isCompleted = i < current}
			<button
				type="button"
				class="onb-segment"
				class:is-active={isActive}
				class:is-completed={isCompleted}
				disabled={i > current}
				aria-label={`Step ${i + 1}: ${s.label}`}
				aria-current={isActive ? 'step' : undefined}
				onclick={() => handleSelect(i)}
				title={s.label}
			></button>
		{/each}
	</div>

	<!-- Progress Label and Current Step Name -->
	<div class="onb-progress-meta">
		<span>
			Step {current + 1} of {steps.length}:
			<strong class="onb-progress-step-name">{steps[current]?.label ?? ''}</strong>
		</span>
		<span>{Math.round(((current + 1) / steps.length) * 100)}% completed</span>
	</div>
</div>
