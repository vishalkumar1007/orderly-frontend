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
		<!-- One progress indicator, at the top of the panel where it reads as
		     part of the frame rather than competing with the footer buttons. -->
		<div
			class="wizard-bar"
			role="progressbar"
			aria-valuemin={1}
			aria-valuemax={steps.length}
			aria-valuenow={current + 1}
			aria-label={`Step ${current + 1} of ${steps.length}`}
		>
			<span style={`width:${((current + 1) / steps.length) * 100}%;`}></span>
		</div>
		<div class="wizard-body">{@render form()}</div>
		<div class="wizard-foot">{@render footer()}</div>
	</div>

	{#if preview}
		<aside class="panel wizard-preview">{@render preview()}</aside>
	{/if}
</div>

<style>
	.wizard-bar {
		height: 3px;
		background: var(--surface-3);
	}

	.wizard-bar span {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, var(--accent), var(--accent-2));
		transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}
</style>
