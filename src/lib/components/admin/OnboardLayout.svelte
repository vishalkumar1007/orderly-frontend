<script lang="ts">
	import type { Snippet } from 'svelte';
	import WizardStepNav from './WizardStepNav.svelte';

	type Step = { id: string; label: string; description?: string };

	let {
		steps = [] as Step[],
		current = 0,
		onStepSelect,
		form,
		preview,
		footer
	}: {
		steps?: Step[];
		current?: number;
		onStepSelect?: (index: number) => void;
		form: Snippet;
		preview?: Snippet;
		footer: Snippet;
	} = $props();
</script>

<div class={['onboard', preview ? '' : 'onboard-wide'].join(' ').trim()}>
	<WizardStepNav {steps} {current} onSelect={onStepSelect} />

	<div class="wizard-panel">
		<p class="wizard-progress-inline" style="padding:1.25rem 1.25rem 0;margin:0;">
			Step {current + 1} of {steps.length}
		</p>
		<div class="wizard-body">{@render form()}</div>
		<div class="wizard-foot">{@render footer()}</div>
	</div>

	{#if preview}
		<aside class="panel wizard-preview">{@render preview()}</aside>
	{/if}
</div>

<style>
	/* Without a preview rail the form takes the full remaining width. */
	@media (min-width: 1120px) {
		.onboard-wide {
			grid-template-columns: 210px minmax(0, 1fr);
		}
	}
</style>
