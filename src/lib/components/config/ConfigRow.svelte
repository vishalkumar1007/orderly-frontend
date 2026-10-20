<script lang="ts">
	/**
	 * One setting: what it is and a line explaining it on the left, its control
	 * on the right. Rows stack inside a flush ConfigCard with hairlines between.
	 */
	import type { Snippet } from 'svelte';
	import type { IconComponent } from '$lib/icons';

	let {
		label,
		description = '',
		icon,
		forId,
		children
	}: {
		label: string;
		description?: string;
		icon?: IconComponent;
		/** The control's id, so clicking the label focuses or toggles it. */
		forId?: string;
		/** The control. */
		children?: Snippet;
	} = $props();
</script>

<div class="cr">
	{#if icon}
		{@const Icon = icon}
		<span class="cr-icon" aria-hidden="true"><Icon size={16} stroke={1.6} /></span>
	{/if}
	<div class="cr-text">
		{#if forId}
			<label class="cr-label" for={forId}>{label}</label>
		{:else}
			<span class="cr-label">{label}</span>
		{/if}
		{#if description}<span class="cr-desc">{description}</span>{/if}
	</div>
	{#if children}<div class="cr-control">{@render children()}</div>{/if}
</div>

<style>
	.cr {
		display: flex;
		align-items: center;
		gap: var(--sp-7);
		padding: var(--sp-8) var(--sp-10);
	}

	.cr + :global(.cr) {
		border-top: 1px solid var(--border-subtle);
	}

	.cr-icon {
		display: grid;
		place-items: center;
		flex: none;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-md, 8px);
		background: var(--icon-bg, var(--surface-2));
		color: var(--icon-fg, var(--text-2));
	}

	.cr-text {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
		flex: 1;
		min-width: 0;
	}

	.cr-label {
		font-size: var(--fs-body);
		font-weight: 600;
		color: var(--text);
	}

	.cr-desc {
		font-size: var(--fs-tab);
		line-height: 1.5;
		color: var(--text-3);
	}

	.cr-control {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		flex: none;
	}

	@media (max-width: 560px) {
		.cr {
			flex-wrap: wrap;
			padding: var(--sp-7) var(--sp-8);
		}
		.cr-control {
			width: 100%;
			justify-content: flex-start;
		}
	}
</style>
