<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import IconPencil from '@tabler/icons-svelte/icons/pencil';

	let {
		label,
		icon: IconComponent,
		badge = '',
		stepNumber,
		editLabel = 'Edit',
		onedit,
		children
	}: {
		label: string;
		icon?: any;
		badge?: string;
		stepNumber?: number;
		editLabel?: string;
		onedit?: () => void;
		children: Snippet;
	} = $props();
</script>

<div class="onb-review-card">
	<div class="onb-review-head">
		<div class="onb-review-title-wrap">
			{#if IconComponent}
				<span class="onb-review-icon" aria-hidden="true">
					<IconComponent size={14} stroke={2} />
				</span>
			{:else if stepNumber !== undefined}
				<span class="onb-review-step-num" aria-hidden="true">{stepNumber}</span>
			{/if}
			<span class="onb-review-label">{label}</span>
			{#if badge}
				<span class="onb-review-badge">{badge}</span>
			{/if}
		</div>

		{#if onedit}
			<button
				type="button"
				class="onb-review-edit"
				onclick={onedit}
				title={`Edit ${label}`}
				aria-label={`Edit ${label}`}
			>
				<span>{editLabel}</span>
				<IconPencil size={11} stroke={2} />
			</button>
		{/if}
	</div>

	<div class="onb-review-body">
		{@render children()}
	</div>
</div>

<style>
	.onb-review-card {
		padding: 1rem 1.15rem;
		border-radius: 12px;
		background: var(--onb-surface-card, rgba(16, 21, 34, 0.7));
		border: 1px solid var(--onb-border, rgba(255, 255, 255, 0.08));
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		position: relative;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		box-sizing: border-box;
	}

	.onb-review-card:hover {
		border-color: color-mix(in srgb, var(--portal-accent, #6366f1) 40%, var(--onb-border, rgba(255, 255, 255, 0.12)));
		background: var(--onb-surface-card-hover, rgba(20, 26, 42, 0.78));
		box-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.25);
	}

	.onb-review-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		min-height: 24px;
	}

	.onb-review-title-wrap {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		min-width: 0;
	}

	.onb-review-icon {
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border-radius: 6px;
		background: color-mix(in srgb, var(--portal-accent, #6366f1) 14%, rgba(255, 255, 255, 0.04));
		color: var(--portal-accent, #818cf8);
		flex: none;
	}

	.onb-review-step-num {
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		border-radius: 9999px;
		background: rgba(255, 255, 255, 0.08);
		color: var(--onb-text-muted, #94a3b8);
		font-size: 0.68rem;
		font-weight: 700;
		flex: none;
	}

	.onb-review-label {
		font-size: 0.725rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--onb-text-muted, #94a3b8);
	}

	.onb-review-badge {
		font-size: 0.65rem;
		font-weight: 600;
		padding: 2px 7px;
		border-radius: 9999px;
		background: rgba(255, 255, 255, 0.06);
		color: var(--onb-text-subtle, #cbd5e1);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.onb-review-edit {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 3px 8px;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.03);
		color: var(--onb-text-muted, #94a3b8);
		font-family: inherit;
		font-size: 0.7rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.onb-review-edit:hover {
		color: #ffffff;
		border-color: var(--portal-accent, #6366f1);
		background: color-mix(in srgb, var(--portal-accent, #6366f1) 15%, transparent);
	}

	.onb-review-body {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
</style>
