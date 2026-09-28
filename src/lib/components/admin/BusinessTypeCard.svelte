<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import type { BusinessTypeTemplate } from '$lib/admin/businessTypes';

	/**
	 * One business-type choice.
	 *
	 * The card has to carry enough for the decision to be made once and made
	 * right: what kind of business this is, and what choosing it will actually
	 * do. The second part matters — picking a type here writes a theme, a
	 * layout, a workflow and a set of payment methods onto the new business, so
	 * the card says so instead of leaving it to be discovered later.
	 */
	let {
		template,
		selected = false,
		onselect
	}: {
		template: BusinessTypeTemplate;
		selected?: boolean;
		onselect?: (code: string) => void;
	} = $props();

	const Icon = $derived(template.icon);

	/** The three consequences worth naming on a card this size. */
	const effects = $derived([
		`${template.storefront.product_layout} layout`,
		template.workflow.acceptance_mode === 'AUTO' ? 'auto-accept' : 'staff accept',
		`${template.behaviour.prep_time_minutes} min prep`
	]);
</script>

<button
	type="button"
	class={['bt-card', selected ? 'selected' : ''].join(' ')}
	role="radio"
	aria-checked={selected}
	onclick={() => onselect?.(template.code)}
>
	<span class="bt-head">
		<span class="bt-icon"><Icon size={18} strokeWidth={1.8} /></span>
		<span class="bt-title">
			<strong>{template.label}</strong>
			<span>{template.tagline}</span>
		</span>
		{#if selected}
			<span class="bt-check" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>
		{/if}
	</span>

	<span class="bt-desc">{template.description}</span>

	<span class="bt-effects">
		{#each effects as effect (effect)}
			<span class="bt-chip">{effect}</span>
		{/each}
	</span>
</button>

<style>
	.bt-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
		min-width: 0;
		text-align: left;
		padding: 0.85rem 0.9rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		cursor: pointer;
		transition:
			border-color var(--tr),
			background var(--tr),
			box-shadow var(--tr);
	}

	.bt-card:hover {
		border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
		background: var(--surface-2);
	}

	.bt-card.selected {
		border-color: var(--accent);
		background: var(--accent-soft);
		box-shadow: 0 0 0 2px var(--accent-ring);
	}

	.bt-head {
		display: flex;
		align-items: flex-start;
		gap: 0.55rem;
	}

	.bt-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.85rem;
		height: 1.85rem;
		border-radius: var(--radius-sm);
		background: var(--surface-3);
		color: var(--icon-fg);
		flex-shrink: 0;
	}

	.bt-card.selected .bt-icon {
		background: var(--surface);
	}

	.bt-title {
		display: flex;
		flex-direction: column;
		gap: 0.08rem;
		min-width: 0;
		flex: 1;
	}

	.bt-title strong {
		font-size: 0.86rem;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.bt-title span {
		font-size: 0.7rem;
		color: var(--text-3);
	}

	.bt-check {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1rem;
		height: 1rem;
		border-radius: 999px;
		background: var(--accent);
		color: var(--on-accent);
		flex-shrink: 0;
	}

	.bt-desc {
		font-size: 0.74rem;
		line-height: 1.45;
		color: var(--text-2);
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.bt-effects {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.bt-chip {
		font-size: 0.62rem;
		font-weight: 550;
		padding: 0.1rem 0.35rem;
		border-radius: var(--radius-sm);
		background: var(--surface-3);
		color: var(--text-3);
		text-transform: capitalize;
	}

	.bt-card.selected .bt-chip {
		background: var(--surface);
		color: var(--accent-dark);
	}
</style>
