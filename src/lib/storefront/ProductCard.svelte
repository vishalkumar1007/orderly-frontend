<script lang="ts">
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Flame from '@lucide/svelte/icons/flame';
	import type { StoreProduct } from '$lib/storefront/api';
	import { lineKey } from '$lib/storefront/cart.svelte';
	import { money } from '$lib/storefront/format';

	/**
	 * Professional Food Order App Product Card.
	 *
	 * Supports list, grid, and compact rail layouts with authentic dietary marks
	 * (Veg green circle in square / Non-veg red triangle in square), appetizing
	 * imagery, instant add/stepper micro-interactions, and customisable indicator.
	 */
	let {
		product,
		currency = 'INR',
		layout = 'list',
		inCart = 0,
		orderable = true,
		businessType,
		onadd,
		onstep
	}: {
		product: StoreProduct;
		currency?: string;
		layout?: 'list' | 'grid' | 'compact';
		inCart?: number;
		orderable?: boolean;
		businessType?: string;
		onadd?: (product: StoreProduct) => void;
		onstep?: (product: StoreProduct, delta: number) => void;
	} = $props();

	const isFoodBusiness = $derived(
		!businessType ||
		businessType === 'RESTAURANT' ||
		businessType === 'CAFE' ||
		businessType === 'BAKERY' ||
		businessType === 'JUICE_BAR'
	);
	const showDietMark = $derived(isFoodBusiness && typeof product.is_vegetarian === 'boolean');
	const featuredLabel = $derived(isFoodBusiness ? "Chef's Pick" : 'Featured');

	const hasOptions = $derived(
		(product.option_groups?.some((g) => g.is_active !== false && (g.options?.length ?? 0) > 0) ??
			false) ||
			product.addons.length > 0
	);
	const canQuickAdd = $derived(orderable && product.is_available && !hasOptions);
	const simpleKey = $derived(lineKey(product.id, []));
</script>

<article
	class="sf-product sf-food-card"
	data-layout={layout}
	data-unavailable={String(!product.is_available)}
>
	<!-- Left Side: Item Details -->
	<div class="sf-food-info">
		<div class="sf-food-header">
			{#if showDietMark}
				<span
					class="sf-diet-mark {product.is_vegetarian ? 'sf-diet-veg' : 'sf-diet-nonveg'}"
					title={product.is_vegetarian ? 'Vegetarian' : 'Non-Vegetarian'}
					aria-label={product.is_vegetarian ? 'Vegetarian' : 'Non-Vegetarian'}
				>
					{#if product.is_vegetarian}
						<span class="sf-diet-circle"></span>
					{:else}
						<span class="sf-diet-triangle"></span>
					{/if}
				</span>
			{/if}

			{#if product.is_popular}
				<span class="sf-badge sf-badge-popular">
					<Flame size={12} strokeWidth={2.5} aria-hidden="true" />
					Bestseller
				</span>
			{:else if product.is_featured}
				<span class="sf-badge sf-badge-featured">
					<Sparkles size={11} strokeWidth={2.4} aria-hidden="true" />
					{featuredLabel}
				</span>
			{/if}

			{#if !product.is_available}
				<span class="sf-badge sf-badge-soldout">Unavailable</span>
			{/if}
		</div>

		<a
			class="sf-food-title-link"
			href={'/product/' + product.id}
			aria-label="{product.name}, {money(product.price, currency)}"
		>
			<h3 class="sf-food-name">{product.name}</h3>
		</a>

		<div class="sf-food-price-row">
			<span class="sf-food-price">{money(product.price, currency)}</span>
		</div>

		{#if product.description && layout !== 'compact'}
			<p class="sf-food-desc">{product.description}</p>
		{/if}
	</div>

	<!-- Right Side: Dish Media & Action Stepper -->
	<div class="sf-food-media-wrap">
		<a
			class="sf-food-media"
			href={'/product/' + product.id}
			tabindex="-1"
			aria-hidden="true"
		>
			{#if product.image_url}
				<img
					src={product.image_url}
					alt={product.name}
					width="128"
					height="128"
					loading="lazy"
					decoding="async"
					class="sf-food-img"
				/>
			{:else}
				<div class="sf-food-placeholder">
					<svg
						width="32"
						height="32"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.4"
						aria-hidden="true"
					>
						<path
							d="M3 11h18M5 11v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
						/>
					</svg>
				</div>
			{/if}
		</a>

		<!-- Action: Quick Add / Stepper or Customise -->
		{#if orderable && product.is_available}
			<div class="sf-food-action">
				{#if canQuickAdd}
					{#if inCart > 0}
						<div class="sf-qty-stepper sf-food-stepper" role="group" aria-label="Quantity of {product.name}">
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
							class="sf-add-btn sf-food-add-btn"
							type="button"
							onclick={() => onadd?.(product)}
						>
							<span class="sf-add-text">ADD</span>
							<Plus size={14} strokeWidth={2.8} aria-hidden="true" />
							<span class="sf-sr-only">Add {product.name} to cart</span>
						</button>
					{/if}
				{:else if hasOptions}
					<a
						class="sf-add-btn sf-food-add-btn sf-has-options"
						href={'/product/' + product.id}
					>
						<span class="sf-add-text">ADD</span>
						<Plus size={14} strokeWidth={2.8} aria-hidden="true" />
					</a>
					<span class="sf-customisable-hint">Customisable</span>
				{/if}
			</div>
		{/if}
	</div>
</article>
