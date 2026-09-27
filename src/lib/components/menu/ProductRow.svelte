<script lang="ts">
	import { IndianRupee, Leaf, Pencil, Star, Trash, TrendingUp, UtensilsCrossed } from '@lucide/svelte/icons';
	import Switch from '$lib/components/admin/Switch.svelte';

	type Addon = { name: string; price: number };

	type Product = {
		id: string;
		category_id: string;
		name: string;
		price: number;
		is_available: boolean;
		description: string;
		image_url?: string;
		is_vegetarian?: boolean;
		is_featured?: boolean;
		is_popular?: boolean;
		addons?: Addon[];
	};

	let {
		product,
		categoryName,
		onedit,
		ondelete,
		ontoggle
	}: {
		product: Product;
		categoryName: string;
		onedit: () => void;
		ondelete: () => void;
		ontoggle: () => void;
	} = $props();
</script>

<div class="product-row" class:off={!product.is_available}>
	<div class="product-main">
		<div class="product-top">
			{#if product.image_url}
				<img class="product-thumb" src={product.image_url} alt="" loading="lazy" />
			{:else}
				<span class="product-thumb product-thumb-placeholder">
					<UtensilsCrossed size={18} strokeWidth={1.6} />
				</span>
			{/if}
			<div class="product-info">
				<span class="product-name">{product.name}</span>
				<span class="product-price">
					<IndianRupee size={12} strokeWidth={2.2} />{product.price}
				</span>
			</div>
		</div>
		{#if product.description}
			<p class="product-desc">{product.description}</p>
		{/if}
		<div class="product-meta">
			<span class="product-cat">{categoryName}</span>
			{#if product.is_vegetarian}
				<span class="badge badge-ok"><Leaf size={10} strokeWidth={2.2} /> Veg</span>
			{/if}
			{#if product.is_featured}
				<span class="badge badge-warn"><Star size={10} strokeWidth={2.2} /> Featured</span>
			{/if}
			{#if product.is_popular}
				<span class="badge badge-accent"><TrendingUp size={10} strokeWidth={2.2} /> Popular</span>
			{/if}
			{#if !product.is_available}
				<span class="badge badge-neutral">Sold out</span>
			{/if}
		</div>
	</div>

	<div class="product-actions">
		<Switch
			checked={product.is_available}
			label={product.is_available ? 'Available' : 'Sold out'}
			onchange={ontoggle}
		/>
		<button
			class="product-icon-btn"
			type="button"
			aria-label={`Edit ${product.name}`}
			title="Edit"
			onclick={onedit}
		>
			<Pencil size={15} strokeWidth={1.9} />
		</button>
		<button
			class="product-icon-btn danger"
			type="button"
			aria-label={`Remove ${product.name}`}
			title="Remove"
			onclick={ondelete}
		>
			<Trash size={15} strokeWidth={1.9} />
		</button>
	</div>
</div>

<style>
	.product-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.7rem 0.75rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		min-width: 0;
	}

	.product-row.off {
		opacity: 0.66;
	}

	.product-main {
		flex: 1;
		min-width: 0;
	}

	.product-top {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.product-thumb {
		width: 2.75rem;
		height: 2.75rem;
		border-radius: var(--radius-sm);
		object-fit: cover;
		flex-shrink: 0;
	}

	.product-thumb-placeholder {
		display: grid;
		place-items: center;
		background: var(--surface-3);
		color: var(--text-3);
	}

	.product-info {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		min-width: 0;
	}

	.product-name {
		font-size: 0.92rem;
		font-weight: 650;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.product-price {
		margin-left: auto;
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 0.1rem;
		font-weight: 700;
		font-size: 0.9rem;
		font-variant-numeric: tabular-nums;
	}

	.product-desc {
		margin: 0.15rem 0 0;
		font-size: 0.78rem;
		color: var(--text-3);
		line-height: 1.4;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.product-meta {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.3rem;
		flex-wrap: wrap;
	}

	.product-cat {
		font-size: 0.7rem;
		color: var(--text-3);
		background: var(--surface-3);
		padding: 0.1rem 0.4rem;
		border-radius: 999px;
	}

	.product-actions {
		flex: none;
		display: flex;
		align-items: center;
		gap: 0.15rem;
	}

	.product-icon-btn {
		width: 2.25rem;
		height: 2.25rem;
		display: grid;
		place-items: center;
		border: 1px solid transparent;
		border-radius: 9px;
		background: none;
		color: var(--text-3);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		transition: all var(--tr);
	}

	.product-icon-btn:hover {
		background: var(--surface-3);
		color: var(--text);
	}

	.product-icon-btn.danger:hover {
		color: var(--danger);
		background: var(--danger-bg);
	}

	/* The Switch renders label text after the track; in a dense row we only
	   want the track, so the text is hidden here rather than passed as "". */
	.product-actions :global(.switch) {
		margin: 0;
		gap: 0;
	}

	.product-actions :global(.switch > span:last-child) {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	@media (max-width: 640px) {
		.product-row {
			flex-direction: column;
			align-items: stretch;
		}

		.product-actions {
			justify-content: flex-end;
		}
	}
</style>
