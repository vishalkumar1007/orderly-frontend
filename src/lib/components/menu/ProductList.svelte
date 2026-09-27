<script lang="ts">
	import {
		ChevronDown,
		ChevronUp,
		Copy,
		FolderInput,
		Pencil,
		Trash2,
		UtensilsCrossed
	} from '@lucide/svelte/icons';
	import Menu from '$lib/components/admin/Menu.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import { formatCurrency } from '$lib/admin/format';
	import { productHasOptions, type MenuProduct } from '$lib/tenant/menu';

	let {
		products,
		categoryName,
		currency = 'INR',
		onedit,
		ondelete,
		ontoggle,
		onduplicate,
		onmove,
		onreorder
	}: {
		products: MenuProduct[];
		categoryName: (id: string) => string;
		currency?: string;
		onedit: (p: MenuProduct) => void;
		ondelete: (p: MenuProduct) => void;
		ontoggle: (p: MenuProduct) => void;
		onduplicate: (p: MenuProduct) => void;
		onmove: (p: MenuProduct) => void;
		onreorder: (p: MenuProduct, direction: -1 | 1) => void;
	} = $props();

	function actions(p: MenuProduct) {
		return [
			{ label: 'Edit', onclick: () => onedit(p) },
			{ label: 'Duplicate', onclick: () => onduplicate(p) },
			{ label: 'Move category', onclick: () => onmove(p) },
			{ label: 'Move up', onclick: () => onreorder(p, -1) },
			{ label: 'Move down', onclick: () => onreorder(p, 1) },
			{ label: 'Delete', onclick: () => ondelete(p), danger: true, separatorBefore: true }
		];
	}
</script>

<!-- Desktop table -->
<div class="plist-table panel">
	<table class="table">
		<thead>
			<tr>
				<th style="width:3.5rem;"></th>
				<th>Product</th>
				<th>Category</th>
				<th>Price</th>
				<th>Status</th>
				<th style="width:3rem;"></th>
			</tr>
		</thead>
		<tbody>
			{#each products as p (p.id)}
				<tr class:off={!p.is_available}>
					<td>
						{#if p.image_url}
							<img class="thumb" src={p.image_url} alt="" loading="lazy" />
						{:else}
							<span class="thumb placeholder"><UtensilsCrossed size={16} strokeWidth={1.6} /></span>
						{/if}
					</td>
					<td>
						<button type="button" class="name-btn" onclick={() => onedit(p)}>
							<span class="pname">{p.name}</span>
							{#if productHasOptions(p)}
								<span class="badge badge-neutral">Options</span>
							{/if}
							{#if p.is_featured}
								<span class="badge badge-warn">Featured</span>
							{/if}
						</button>
					</td>
					<td class="muted">{categoryName(p.category_id)}</td>
					<td class="price">{formatCurrency(Number(p.price), currency)}</td>
					<td>
						<Switch
							checked={p.is_available}
							label={p.is_available ? 'On' : 'Off'}
							onchange={() => ontoggle(p)}
						/>
					</td>
					<td>
						<Menu items={actions(p)} label="Product actions" />
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<!-- Mobile cards -->
<div class="plist-cards">
	{#each products as p (p.id)}
		<article class="pcard" class:off={!p.is_available}>
			<div class="pcard-main">
				{#if p.image_url}
					<img class="thumb" src={p.image_url} alt="" loading="lazy" />
				{:else}
					<span class="thumb placeholder"><UtensilsCrossed size={18} strokeWidth={1.6} /></span>
				{/if}
				<div class="pcard-info">
					<span class="pname">{p.name}</span>
					<span class="muted">{categoryName(p.category_id)}</span>
					<span class="price">{formatCurrency(Number(p.price), currency)}</span>
				</div>
			</div>
			<div class="pcard-actions">
				<Switch
					checked={p.is_available}
					label={p.is_available ? 'Available' : 'Unavailable'}
					onchange={() => ontoggle(p)}
				/>
				<div class="pcard-icons">
					<button type="button" class="icon-btn" aria-label="Edit" onclick={() => onedit(p)}>
						<Pencil size={15} />
					</button>
					<button type="button" class="icon-btn" aria-label="Duplicate" onclick={() => onduplicate(p)}>
						<Copy size={15} />
					</button>
					<button type="button" class="icon-btn" aria-label="Move up" onclick={() => onreorder(p, -1)}>
						<ChevronUp size={15} />
					</button>
					<button type="button" class="icon-btn" aria-label="Move down" onclick={() => onreorder(p, 1)}>
						<ChevronDown size={15} />
					</button>
					<button type="button" class="icon-btn" aria-label="Move category" onclick={() => onmove(p)}>
						<FolderInput size={15} />
					</button>
					<button type="button" class="icon-btn danger" aria-label="Delete" onclick={() => ondelete(p)}>
						<Trash2 size={15} />
					</button>
				</div>
			</div>
		</article>
	{/each}
</div>

<style>
	.plist-table {
		overflow: auto;
		padding: 0;
	}
	.plist-table :global(table) {
		margin: 0;
	}
	.plist-table th,
	.plist-table td {
		vertical-align: middle;
	}
	.thumb {
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 8px;
		object-fit: cover;
		display: block;
		background: var(--surface-3);
	}
	.thumb.placeholder {
		display: grid;
		place-items: center;
		color: var(--text-3);
		border: 1px solid var(--border);
	}
	.name-btn {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
		border: none;
		background: none;
		padding: 0;
		font: inherit;
		color: inherit;
		cursor: pointer;
		text-align: left;
	}
	.pname {
		font-weight: 600;
	}
	.muted {
		color: var(--text-3);
		font-size: 0.82rem;
	}
	.price {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	tr.off,
	.pcard.off {
		opacity: 0.72;
	}
	.plist-cards {
		display: none;
		flex-direction: column;
		gap: 0.55rem;
	}
	.pcard {
		padding: 0.85rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.pcard-main {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
	}
	.pcard-info {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}
	.pcard-actions {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}
	.pcard-icons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	.icon-btn {
		width: 2.4rem;
		height: 2.4rem;
		display: grid;
		place-items: center;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		color: var(--text-2);
		cursor: pointer;
	}
	.icon-btn:hover {
		border-color: var(--accent);
		color: var(--accent-dark);
	}
	.icon-btn.danger:hover {
		border-color: var(--danger);
		color: var(--danger);
		background: var(--danger-bg);
	}
	@media (max-width: 767px) {
		.plist-table {
			display: none;
		}
		.plist-cards {
			display: flex;
		}
	}
	@media (min-width: 768px) {
		.plist-cards {
			display: none;
		}
	}
</style>
