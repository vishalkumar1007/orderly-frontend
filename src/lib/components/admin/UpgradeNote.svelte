<script lang="ts">
	import Lock from '@tabler/icons-svelte/icons/lock';

	/**
	 * The one way the console says "your plan doesn't include this". Always names
	 * the plan that does, so a locked control explains itself instead of just
	 * being greyed out.
	 */
	let {
		feature,
		requiredPlan = ''
	}: {
		/** What is locked, in the owner's words: "SMS messages". */
		feature: string;
		requiredPlan?: string;
	} = $props();
</script>

<p class="upgrade-note">
	<Lock size={13} stroke={1.6} aria-hidden="true" />
	<span>
		{feature} {requiredPlan ? `is available on the ${requiredPlan} plan.` : 'is not included in your plan.'}
		Ask your account manager to upgrade.
	</span>
</p>

<style>
	.upgrade-note {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		margin: 0;
		padding: var(--sp-4) var(--sp-6);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--warn) 7%, transparent);
		font-size: var(--fs-meta);
		color: var(--text-2);
	}

	.upgrade-note :global(svg) {
		flex-shrink: 0;
		color: var(--warn);
	}
</style>
