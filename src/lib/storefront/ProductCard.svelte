<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Plus from '@lucide/svelte/icons/plus';
	import type { StoreProduct } from '$lib/storefront/api';
	import { money } from '$lib/storefront/format';

	/**
	 * One product in a list.
	 *
	 * The whole card is a link, because on a phone the target for "I want this"
	 * is the card itself — a small "Add" button inside a 84px image column is a
	 * worse tap target than the row. The add button is the shortcut for products
	 * that need no customisation, so a customer with no add-ons can order in one
	 * tap.
	 */
	let {
		product,
		currency = 'INR',
		/** Quantity already in the cart, used for the "added" state. */
		inCart = 0,
		/** Ordering is off: the card stays browsable but cannot be added. */
		orderable = true,
		onadd
	}: {
		product: StoreProduct;
		currency?: string;
		inCart?: number;
		orderable?: boolean;
		onadd?: (product: StoreProduct) => void;
	} = $props();

	const hasOptions = $derived(product.addons.length > 0);
	const canQuickAdd = $derived(orderable && product.is_available && !hasOptions);
</script>

<article class="sf-product" data-unavailable={String(!product.is_available)}>
	<a
		href={'/product/' + product.id}
		style="display:contents;text-decoration:none;color:inherit;"
		aria-label="{product.name}, {money(product.price, currency)}"
	>
		<span class="sf-product-media">
			{#if product.image_url}
				<!--
					Product images are the heaviest thing on a storefront. They are
					lazy, async-decoded and given intrinsic dimensions so the card
					never shifts while they load.
				-->
				<img
					src={product.image_url}
					alt=""
					width="84"
					height="84"
					loading="lazy"
					decoding="async"
				/>
			{:else}
				<svg
					width="30"
					height="30"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					style="color:var(--sf-text-3)"
					aria-hidden="true"
				>
					<path d="M3 11h18M5 11v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
				</svg>
			{/if}
		</span>

		<span class="sf-product-body">
			<span class="sf-product-name">
				{product.name}
				{#if product.is_vegetarian}
					<span class="sf-veg-mark" title="Vegetarian" aria-label="Vegetarian">
						<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" aria-hidden="true">
							<path d="M20 6 9 17l-5-5" />
						</svg>
					</span>
				{/if}
				{#if !product.is_available}
					<span class="sf-tag" data-tone="sold-out">Sold out</span>
				{/if}
			</span>

			{#if product.description}
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
		<button
			class="sf-add-btn"
			type="button"
			data-in-cart={String(inCart > 0)}
			style="grid-column:2;justify-self:end;margin-top:-2px;"
			onclick={() => onadd?.(product)}
		>
			{#if inCart > 0}
				<Check size={15} strokeWidth={2.6} aria-hidden="true" />
				{inCart}
			{:else}
				<Plus size={15} strokeWidth={2.6} aria-hidden="true" />
				Add
			{/if}
			<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);">
				Add {product.name} to cart
			</span>
		</button>
	{/if}
</article>
