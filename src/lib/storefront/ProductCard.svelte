<script lang="ts">
	import Minus from '@tabler/icons-svelte/icons/minus';
	import Plus from '@tabler/icons-svelte/icons/plus';
	import type { StoreProduct } from '$lib/storefront/api';
	import { money } from '$lib/storefront/format';
	import { keyDetails, type CardShape, type Experience } from '$lib/storefront/experience';

	/**
	 * One catalogue item. `list` is the food-app row (words left, photo right
	 * with Add sitting on its edge), `grid` puts the photo on top, `compact` is
	 * the rail tile, `tile` is the grocery and fashion photo tile, and `spec`
	 * is the electronics row with its key details.
	 */
	let {
		product,
		currency = 'INR',
		layout = 'list',
		inCart = 0,
		orderable = true,
		exp = undefined,
		onadd,
		onstep
	}: {
		product: StoreProduct;
		currency?: string;
		layout?: CardShape;
		inCart?: number;
		orderable?: boolean;
		/** Without one the card behaves as a food item. */
		exp?: Experience;
		onadd?: (product: StoreProduct) => void;
		onstep?: (product: StoreProduct, delta: number) => void;
	} = $props();

	const variant = $derived(exp?.variant ?? 'food');
	const showDiet = $derived(
		(exp?.features.dietMarks ?? true) && typeof product.is_vegetarian === 'boolean'
	);
	const tag = $derived(
		product.is_popular ? 'Bestseller' : product.is_featured ? (exp?.words.pick ?? "Chef's pick") : ''
	);
	const details = $derived(layout === 'spec' ? keyDetails(product.description ?? '') : []);
	const hasOptions = $derived(
		(product.option_groups?.some((g) => g.is_active !== false && (g.options?.length ?? 0) > 0) ??
			false) ||
			product.addons.length > 0
	);
	// Clothes need a size first, so a fashion tile with choices opens the
	// product page instead of showing an Add button.
	const canBuy = $derived(
		orderable && product.is_available && !(variant === 'fashion' && hasOptions)
	);
	const href = $derived('/product/' + product.id);
	// Rails always show a picture frame so the row of tiles lines up.
	const showMedia = $derived(Boolean(product.image_url) || layout !== 'list');
</script>

<article class="pc" data-layout={layout} data-variant={variant} data-off={!product.is_available}>
	<div class="pc-info">
		{#if showDiet || tag}
			<div class="pc-meta">
				{#if showDiet}
					<span
						class="pc-diet"
						data-veg={product.is_vegetarian}
						role="img"
						aria-label={product.is_vegetarian ? 'Vegetarian' : 'Non-vegetarian'}
					></span>
				{/if}
				{#if tag && layout !== 'compact'}
					<span class="pc-tag">{tag}</span>
				{/if}
			</div>
		{/if}

		<h3 class="pc-name"><a {href}>{product.name}</a></h3>
		<p class="pc-price">{money(product.price, currency)}</p>
		{#if details.length}
			<ul class="pc-details">
				{#each details as line, i (i)}<li>{line}</li>{/each}
			</ul>
		{:else if product.description && layout !== 'compact' && layout !== 'tile'}
			<p class="pc-desc">{product.description}</p>
		{/if}
		{#if !product.is_available}
			<p class="pc-off">Sold out for now</p>
		{/if}
	</div>

	{#if showMedia || canBuy}
		<div class="pc-media" class:pc-bare={!showMedia}>
			{#if showMedia}
				<a class="pc-photo" {href} tabindex="-1" aria-hidden="true">
					{#if product.image_url}
						<img src={product.image_url} alt="" loading="lazy" decoding="async" />
					{:else}
						<span class="pc-initial">{product.name.charAt(0)}</span>
					{/if}
				</a>
			{/if}

			{#if canBuy}
				<div class="pc-action">
					{#if hasOptions}
						<a class="pc-add" {href} aria-label="Add {product.name}, choose options">Add</a>
					{:else if inCart > 0}
						<div class="pc-step" role="group" aria-label="Quantity of {product.name}">
							<button type="button" aria-label="Remove one {product.name}" onclick={() => onstep?.(product, -1)}>
								<Minus size={15} stroke={2.2} aria-hidden="true" />
							</button>
							<span aria-live="polite">{inCart}</span>
							<button type="button" aria-label="Add one more {product.name}" onclick={() => onstep?.(product, 1)}>
								<Plus size={15} stroke={2.2} aria-hidden="true" />
							</button>
						</div>
					{:else}
						<button class="pc-add" type="button" aria-label="Add {product.name}" onclick={() => onadd?.(product)}>
							Add
						</button>
					{/if}
				</div>
				{#if hasOptions && layout !== 'compact' && layout !== 'tile'}
					<span class="pc-hint">Customisable</span>
				{/if}
			{/if}
		</div>
	{/if}
</article>

<style>
	.pc {
		--pc-photo: 118px;
		--pc-tint: color-mix(in srgb, var(--sf-primary) 14%, var(--sf-surface));
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 16px;
		padding: 20px 0 22px;
		color: var(--sf-text);
	}

	.pc-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	.pc-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 16px;
	}

	/* The FSSAI marks: a green dot or a red-brown triangle in a square. These
	   colours are a legal convention, not branding, so they ignore the theme. */
	.pc-diet {
		display: inline-grid;
		place-items: center;
		width: 14px;
		height: 14px;
		border: 1.5px solid #0f8a3c;
		border-radius: 3px;
		flex: none;
	}
	.pc-diet::after {
		content: '';
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #0f8a3c;
	}
	.pc-diet[data-veg='false'] {
		border-color: #a8331d;
	}
	.pc-diet[data-veg='false']::after {
		width: 0;
		height: 0;
		border-radius: 0;
		background: none;
		border-inline: 3.5px solid transparent;
		border-bottom: 6px solid #a8331d;
	}

	.pc-tag {
		font-size: 12.5px;
		font-weight: 600;
		color: var(--sf-primary);
	}

	.pc-name {
		margin: 0;
		font-size: 16.5px;
		font-weight: 600;
		line-height: 1.3;
		letter-spacing: -0.005em;
	}
	.pc-name a {
		color: inherit;
		text-decoration: none;
	}
	.pc-name a:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.pc-price {
		margin: 0;
		font-size: 15px;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}

	.pc-desc {
		margin: 6px 0 0;
		color: var(--sf-text-2);
		font-size: 14px;
		line-height: 1.45;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.pc-off {
		margin: 6px 0 0;
		color: var(--sf-danger);
		font-size: 13px;
		font-weight: 500;
	}
	.pc[data-off='true'] .pc-photo {
		filter: grayscale(1);
		opacity: 0.6;
	}

	.pc-media {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		width: var(--pc-photo);
	}
	.pc-media.pc-bare {
		justify-content: center;
	}

	.pc-photo {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		overflow: hidden;
		border-radius: var(--sf-radius);
		background: var(--sf-surface-2);
	}
	.pc-photo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	/* No photo yet: the dish's first letter on a wash of the shop's colour,
	   so the tile still belongs to this shop instead of looking broken. */
	.pc-initial {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		background: var(--pc-tint);
		color: var(--sf-primary);
		font-family: var(--sf-font-display, var(--sf-font));
		font-size: 34px;
		font-weight: 700;
		text-transform: uppercase;
	}

	.pc-action {
		position: relative;
		margin-top: -18px;
	}
	.pc-bare .pc-action {
		margin-top: 0;
	}

	.pc-add,
	.pc-step {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 96px;
		height: 38px;
		border-radius: var(--sf-btn-radius, 10px);
		font: inherit;
		font-size: 15px;
		font-weight: 700;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
	}

	.pc-add {
		padding: 0 18px;
		border: 1px solid var(--sf-border-strong);
		background: var(--sf-surface);
		color: var(--sf-primary);
		text-decoration: none;
		cursor: pointer;
		transition:
			background 0.15s,
			border-color 0.15s;
	}
	.pc-add:hover {
		border-color: var(--sf-primary);
		background: var(--pc-tint);
	}

	.pc-step {
		justify-content: space-between;
		background: var(--sf-primary);
		color: var(--sf-primary-ink);
		font-variant-numeric: tabular-nums;
	}
	.pc-step button {
		display: grid;
		place-items: center;
		width: 34px;
		height: 100%;
		border: 0;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.pc-add:focus-visible,
	.pc-step button:focus-visible,
	.pc-name a:focus-visible {
		outline: 2px solid var(--sf-primary);
		outline-offset: 2px;
	}

	.pc-hint {
		margin-top: 6px;
		font-size: 12px;
		color: var(--sf-text-3);
	}

	/* Photo on top, for shops that chose the grid layout. */
	.pc[data-layout='grid'] {
		grid-template-columns: 1fr;
		grid-template-rows: auto 1fr;
		gap: 12px;
		padding: 0;
	}
	.pc[data-layout='grid'] .pc-media {
		order: -1;
		width: 100%;
	}
	.pc[data-layout='grid'] .pc-photo {
		aspect-ratio: 4 / 3;
	}
	.pc[data-layout='grid'] .pc-action {
		align-self: flex-end;
		margin: -19px 12px 0 0;
	}

	/* Rail tile. */
	.pc[data-layout='compact'] {
		grid-template-columns: 1fr;
		gap: 10px;
		padding: 0;
	}
	.pc[data-layout='compact'] .pc-media {
		order: -1;
		width: 100%;
	}
	.pc[data-layout='compact'] .pc-action {
		margin-top: -17px;
	}
	.pc[data-layout='compact'] .pc-add,
	.pc[data-layout='compact'] .pc-step {
		min-width: 84px;
		height: 34px;
		font-size: 14px;
	}
	.pc[data-layout='compact'] .pc-meta {
		position: absolute;
		top: 8px;
		left: 8px;
		min-height: 0;
	}
	.pc[data-layout='compact'] .pc-diet {
		background: #fff;
	}
	.pc[data-layout='compact'] .pc-name {
		font-size: 15px;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.pc[data-layout='compact'] {
		position: relative;
	}

	/* Grocery and fashion: a photo tile, Add on the photo's corner. */
	.pc[data-layout='tile'] {
		position: relative;
		grid-template-columns: 1fr;
		gap: 8px;
		padding: 0;
	}
	.pc[data-layout='tile'] .pc-media {
		order: -1;
		width: 100%;
	}
	.pc[data-layout='tile'] .pc-action {
		align-self: flex-end;
		margin: -42px 8px 0 0;
	}
	.pc[data-layout='tile'] .pc-add,
	.pc[data-layout='tile'] .pc-step {
		min-width: 72px;
		height: 34px;
		font-size: 14px;
	}
	.pc[data-layout='tile'] .pc-name {
		font-size: 14.5px;
		font-weight: 500;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.pc[data-layout='tile'] .pc-price {
		order: 2;
		font-weight: 600;
	}
	.pc[data-layout='tile'] .pc-meta {
		position: absolute;
		top: 8px;
		left: 8px;
		min-height: 0;
	}
	.pc[data-layout='tile'] .pc-diet {
		background: #fff;
	}
	.pc[data-layout='tile'] .pc-tag {
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--sf-surface);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
	}
	/* Clothes are photographed tall. */
	.pc[data-variant='fashion'] .pc-photo {
		aspect-ratio: 4 / 5;
		border-radius: var(--sf-radius-sm);
	}
	.pc[data-variant='fashion'] .pc-name {
		font-size: 15px;
	}

	/* Electronics: photo left, the details that decide a purchase right. */
	.pc[data-layout='spec'] {
		grid-template-columns: auto minmax(0, 1fr);
		gap: 16px;
	}
	.pc[data-layout='spec'] .pc-media {
		order: -1;
		width: 104px;
	}
	.pc[data-layout='spec'] .pc-photo {
		background: var(--sf-surface-2);
	}
	.pc[data-layout='spec'] .pc-photo img {
		object-fit: contain;
		padding: 6px;
	}
	.pc[data-layout='spec'] .pc-action {
		margin-top: 10px;
	}
	.pc[data-layout='spec'] .pc-add,
	.pc[data-layout='spec'] .pc-step {
		min-width: 104px;
		box-shadow: none;
	}
	.pc[data-layout='spec'] .pc-price {
		font-size: 17px;
		font-weight: 700;
	}
	.pc-details {
		margin: 6px 0 0;
		padding: 0;
		list-style: none;
		color: var(--sf-text-2);
		font-size: 13.5px;
		line-height: 1.5;
	}
	.pc-details li {
		position: relative;
		padding-left: 12px;
	}
	.pc-details li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0.65em;
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: var(--sf-text-3);
	}

	@media (min-width: 720px) {
		.pc {
			--pc-photo: 140px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pc-add {
			transition: none;
		}
	}
</style>
