<script lang="ts">
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import type { StoreProduct } from '$lib/storefront/api';
	import { lineKey } from '$lib/storefront/cart.svelte';
	import { money } from '$lib/storefront/format';

	/**
	 * One product card.
	 *
	 * The whole card links to detail (options / notes). Quick-add items get an
	 * Add button that becomes a qty stepper once in the cart — another of the
	 * same dish is one tap, no cart round-trip.
	 */
	let {
		product,
		currency = 'INR',
		layout = 'list',
		inCart = 0,
		orderable = true,
		onadd,
		onstep
	}: {
		product: StoreProduct;
		currency?: string;
		layout?: 'list' | 'grid' | 'compact';
		inCart?: number;
		orderable?: boolean;
		onadd?: (product: StoreProduct) => void;
		onstep?: (product: StoreProduct, delta: number) => void;
	} = $props();

	const hasOptions = $derived(
		(product.option_groups?.some((g) => g.is_active !== false && (g.options?.length ?? 0) > 0) ??
			false) ||
			product.addons.length > 0
	);
	const canQuickAdd = $derived(orderable && product.is_available && !hasOptions);
	const simpleKey = $derived(lineKey(product.id, []));
</script>

<article
	class="sf-product"
	data-layout={layout}
	data-unavailable={String(!product.is_available)}
>
	<a
		class="sf-product-link"
		href={'/product/' + product.id}
		aria-label="{product.name}, {money(product.price, currency)}"
	>
		<span class="sf-product-media">
			{#if product.image_url}
				<img
					src={product.image_url}
					alt=""
					width="96"
					height="96"
					loading="lazy"
					decoding="async"
				/>
			{:else}
				<svg
					width="28"
					height="28"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					aria-hidden="true"
				>
					<path
						d="M3 11h18M5 11v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
					/>
				</svg>
			{/if}
		</span>

		<span class="sf-product-body">
			<span class="sf-product-name">
				{product.name}
				{#if product.is_vegetarian}
					<span class="sf-veg-mark" title="Vegetarian" aria-label="Vegetarian">
						<svg
							width="9"
							height="9"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="3.5"
							aria-hidden="true"
						>
							<path d="M20 6 9 17l-5-5" />
						</svg>
					</span>
				{/if}
				{#if product.is_popular}
					<span class="sf-tag" data-tone="popular">Popular</span>
				{/if}
				{#if !product.is_available}
					<span class="sf-tag" data-tone="sold-out">Sold out</span>
				{/if}
			</span>

			{#if product.description && layout !== 'compact'}
				<span class="sf-product-desc">{product.description}</span>
			{/if}

			<span class="sf-product-foot">
				<span class="sf-product-price">{money(product.price, currency)}</span>
				{#if hasOptions}
					<span class="sf-tag">Options</span>
				{/if}
			</span>
		</span>
	</a>

	{#if canQuickAdd}
		{#if inCart > 0}
			<div class="sf-qty-stepper" role="group" aria-label="Quantity of {product.name}">
				<button
					class="sf-qty-btn"
					type="button"
					aria-label="Remove one {product.name}"
					onclick={() => onstep?.(product, -1)}
				>
					<Minus size={14} strokeWidth={2.6} aria-hidden="true" />
				</button>
				<span class="sf-qty-value" data-key={simpleKey}>{inCart}</span>
				<button
					class="sf-qty-btn"
					type="button"
					aria-label="Add one {product.name}"
					onclick={() => onstep?.(product, 1)}
				>
					<Plus size={14} strokeWidth={2.6} aria-hidden="true" />
				</button>
			</div>
		{:else}
			<button
				class="sf-add-btn"
				type="button"
				onclick={() => onadd?.(product)}
			>
				<Plus size={15} strokeWidth={2.6} aria-hidden="true" />
				Add
				<span class="sf-sr-only">Add {product.name} to cart</span>
			</button>
		{/if}
	{/if}
</article>
