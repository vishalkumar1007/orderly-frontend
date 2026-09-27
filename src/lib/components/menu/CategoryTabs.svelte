<script lang="ts">
	import { Plus, X } from '@lucide/svelte/icons';
	import type { MenuCategory } from '$lib/tenant/menu';

	let {
		categories,
		counts,
		active,
		onselect,
		onadd,
		ondelete
	}: {
		categories: MenuCategory[];
		counts: Record<string, number>;
		active: string;
		onselect: (id: string) => void;
		onadd: () => void;
		ondelete: (id: string, name: string) => void;
	} = $props();
</script>

<div class="cat-tabs" role="tablist" aria-label="Categories">
	<button
		class="cat-tab"
		class:active={active === ''}
		role="tab"
		aria-selected={active === ''}
		onclick={() => onselect('')}
	>
		All
		<span class="cat-tab-count">{Object.values(counts).reduce((a, b) => a + b, 0)}</span>
	</button>
	{#each categories as c (c.id)}
		<button
			class="cat-tab"
			class:active={active === c.id}
			class:inactive={!c.is_active}
			role="tab"
			aria-selected={active === c.id}
			onclick={() => onselect(c.id)}
		>
			{c.name}
			<span class="cat-tab-count">{counts[c.id] ?? 0}</span>
			<span
				class="cat-tab-delete"
				role="button"
				aria-label={`Delete ${c.name}`}
				title="Delete category"
				onclick={(e) => {
					e.stopPropagation();
					ondelete(c.id, c.name);
				}}
			>
				<X size={12} strokeWidth={2.2} />
			</span>
		</button>
	{/each}
	<button class="cat-tab cat-tab-add" type="button" onclick={onadd}>
		<Plus size={14} strokeWidth={2.2} /> Add
	</button>
</div>

<style>
	.cat-tabs {
		display: flex;
		gap: 0.25rem;
		overflow-x: auto;
		padding-bottom: 0.25rem;
		scrollbar-width: thin;
	}
	.cat-tab {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.4rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface);
		color: var(--text-2);
		font-size: 0.8rem;
		font-weight: 550;
		font-family: inherit;
		white-space: nowrap;
		cursor: pointer;
		flex-shrink: 0;
		transition: all var(--tr);
	}
	.cat-tab:hover {
		border-color: color-mix(in srgb, var(--accent) 25%, var(--border));
		color: var(--text);
	}
	.cat-tab.active {
		background: var(--accent-soft);
		border-color: var(--accent);
		color: var(--accent-dark);
	}
	.cat-tab.inactive {
		opacity: 0.55;
	}
	.cat-tab-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.3rem;
		border-radius: 999px;
		background: var(--surface-3);
		color: var(--text-3);
		font-size: 0.68rem;
		font-weight: 650;
	}
	.cat-tab.active .cat-tab-count {
		background: var(--accent);
		color: #fff;
	}
	.cat-tab-delete {
		display: none;
		align-items: center;
		justify-content: center;
		width: 1.1rem;
		height: 1.1rem;
		border-radius: 999px;
		color: var(--text-3);
		margin-left: -0.15rem;
	}
	.cat-tab:hover .cat-tab-delete {
		display: inline-flex;
	}
	.cat-tab-delete:hover {
		background: var(--danger-bg);
		color: var(--danger);
	}
	.cat-tab-add {
		border-style: dashed;
		color: var(--text-3);
	}
	.cat-tab-add:hover {
		color: var(--accent-dark);
		border-color: var(--accent);
	}
</style>
