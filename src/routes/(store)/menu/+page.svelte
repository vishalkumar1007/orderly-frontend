<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
	import ProductCard from '$lib/storefront/ProductCard.svelte';
	import { useCart } from '$lib/storefront/cart-state.svelte';
	import type { StoreProduct } from '$lib/storefront/api';

	/**
	 * The full menu.
	 *
	 * Search filters across every category at once, and the category chips jump to
	 * a section rather than hiding the others. A customer comparing two dishes in
	 * different categories should be able to see both.
	 */
	let { data } = $props();

	const cart = useCart();
	const config = $derived(data.config);
	const menu = $derived(data.menu);
	const query = $derived($page.url.searchParams.get('q')?.trim() ?? '');

	/**
	 * `results` is null when nothing is being searched, which is different from an
	 * empty result set — the page shows the full menu in the first case and "no
	 * matches" in the second.
	 */
	const results = $derived.by(() => {
		if (!menu) return null;
		if (!query) return null;
		const needle = query.toLowerCase();
		return menu.products.filter(
			(p) =>
				p.name.toLowerCase().includes(needle) ||
				(p.description ?? '').toLowerCase().includes(needle)
		);
	});

	function add(product: StoreProduct) {
		cart.add(product, 1);
	}

	/** Category chips carry the current search so filtering survives a jump. */
	function categoryHref(id: string): string {
		const suffix = query ? `?q=${encodeURIComponent(query)}` : '';
		return `/menu${suffix}#${id}`;
	}
</script>

{#if !menu}
	<div class="sf-wrap" style="padding-top:28px;">
		<div class="sf-empty">
			<span class="sf-empty-icon" aria-hidden="true">
				<UtensilsCrossed size={26} strokeWidth={1.7} />
			</span>
			<h3>Menu unavailable</h3>
			<p>{data.menuError || 'This store has not published its menu yet.'}</p>
		</div>
	</div>
{:else}
	{#if !query && menu.categories.length > 1}
		<nav class="sf-chips" aria-label="Categories" style="padding-top:12px;">
			{#each menu.categories as category (category.id)}
				<a class="sf-chip" href={categoryHref(category.id)}>{category.name}</a>
			{/each}
		</nav>
	{/if}

	{#if results}
		<div class="sf-wrap" style="padding-top:16px;">
			<div class="sf-section-head" style="padding-inline:0;margin-bottom:10px;">
				<h2>{results.length} result{results.length === 1 ? '' : 's'} for “{query}”</h2>
				<button
					type="button"
					style="border:none;background:transparent;color:var(--sf-primary);font:inherit;font-weight:600;cursor:pointer;padding:0;"
					onclick={() => goto('/menu', { replaceState: true })}
				>
					Clear
				</button>
			</div>
			{#if results.length === 0}
				<div class="sf-empty">
					<span class="sf-empty-icon" aria-hidden="true">
						<UtensilsCrossed size={26} strokeWidth={1.7} />
					</span>
					<h3>Nothing matched</h3>
					<p>Try a shorter word, or browse every category.</p>
				</div>
			{:else}
				<div class="sf-products" data-columns="true">
					{#each results as product (product.id)}
						<ProductCard
							{product}
							currency={config?.store?.currency ?? 'INR'}
							inCart={cart.quantityOf(product.id)}
							orderable={config?.ordering.enabled ?? false}
							onadd={add}
						/>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<div class="sf-wrap" style="padding-top:4px;">
			{#each menu.categories as category (category.id)}
				{#if category.products.length > 0}
					<section id={category.id} style="scroll-margin-top:120px;margin-top:18px;">
						<div class="sf-section-head" style="padding-inline:0;margin-bottom:8px;">
							<h2>{category.name}</h2>
							<span style="font-size:0.75rem;color:var(--sf-text-3);">
								{category.products.length} {category.products.length === 1 ? 'item' : 'items'}
							</span>
						</div>
						{#if category.description}
							<p style="margin:0 0 10px;font-size:0.8125rem;color:var(--sf-text-2);">
								{category.description}
							</p>
						{/if}
						<div class="sf-products" data-columns="true">
							{#each category.products as product (product.id)}
								<ProductCard
									{product}
									currency={config?.store?.currency ?? 'INR'}
									inCart={cart.quantityOf(product.id)}
									orderable={config?.ordering.enabled ?? false}
									onadd={add}
								/>
							{/each}
						</div>
					</section>
				{/if}
			{/each}
		</div>
	{/if}
{/if}
