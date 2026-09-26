<script lang="ts">
	import Check from '@lucide/svelte/icons/check';

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
</script>

<ol class="steps" aria-label="Onboarding progress">
	{#each steps as step, i (step.id)}
		{@const state = i === current ? 'active' : i < current ? 'done' : ''}
		<li style="list-style:none;">
			<button
				type="button"
				class={state}
				disabled={i > current}
				aria-current={i === current ? 'step' : undefined}
				onclick={() => i <= current && onSelect?.(i)}
			>
				<span class="steps-num">
					{#if i < current}<Check size={11} strokeWidth={3} />{:else}{i + 1}{/if}
				</span>
				<span class="steps-txt">
					<strong>{step.label}</strong>
					{#if step.description}<span class="steps-desc">{step.description}</span>{/if}
				</span>
			</button>
		</li>
	{/each}
</ol>
