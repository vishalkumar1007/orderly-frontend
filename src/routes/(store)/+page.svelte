<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
	import { useCart } from '$lib/storefront/cart-state.svelte';
	import { lineKey } from '$lib/storefront/cart.svelte';
	import ProductCard from '$lib/storefront/ProductCard.svelte';
	import StoreHome from '$lib/storefront/StoreHome.svelte';
	import type { StoreProduct } from '$lib/storefront/api';

	/**
	 * The storefront home page.
	 *
	 * Everything visible here comes from the tenant's saved layout — the section
	 * list, its order, and which sections are on. The page itself decides
	 * nothing about what a shop should show.
	 */
	let { data } = $props();

	const cart = useCart();
	const config = $derived(data.config);
	const menu = $derived(data.menu);
	const query = $derived($page.url.searchParams.get('q')?.trim() ?? '');
	const layout = $derived(config?.theme?.product_layout ?? 'list');

	const matches = $derived.by(() => {
		if (!menu || !query) return null;
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

	function step(product: StoreProduct, delta: number) {
		cart.step(lineKey(product.id, []), delta);
	}
</script>

{#if !config}
	<!-- The shell already showed the error. Nothing to render here. -->
{:else if !menu}
	<div class="sf-wrap" style="padding-top:28px;">
		<div class="sf-empty">
			<span class="sf-empty-icon" aria-hidden="true">
				<UtensilsCrossed size={26} strokeWidth={1.7} />
			</span>
			<h3>Menu unavailable</h3>
			<p>{data.menuError ?? 'This store has not published its menu yet.'}</p>
		</div>
	</div>
{:else if matches}
	<!-- A search is a full page of results, not a silent filter of the home
	     sections, so a customer always knows whether anything matched. -->
	<div class="sf-wrap" style="padding-top:18px;">
		<div class="sf-section-head" style="padding-inline:0;margin-bottom:10px;">
			<h2>{matches.length} result{matches.length === 1 ? '' : 's'} for “{query}”</h2>
			<button
				type="button"
				style="border:none;background:transparent;color:var(--sf-primary);font:inherit;font-weight:600;cursor:pointer;padding:0;"
				onclick={() => goto('/menu', { replaceState: true })}
			>
				Clear
			</button>
		</div>
		{#if matches.length === 0}
			<div class="sf-empty">
				<span class="sf-empty-icon" aria-hidden="true">
					<UtensilsCrossed size={26} strokeWidth={1.7} />
				</span>
				<h3>Nothing matched</h3>
				<p>Try a different word, or browse the full menu.</p>
				<a class="sf-btn sf-btn-secondary" href="/menu">Browse the menu</a>
			</div>
		{:else}
			<div class="sf-products" data-layout={layout}>
				{#each matches as product (product.id)}
					<ProductCard
						{product}
						{layout}
						currency={config.store.currency}
						inCart={cart.quantityOf(product.id)}
						orderable={config.ordering.enabled}
						onadd={add}
						onstep={step}
					/>
				{/each}
			</div>
		{/if}
	</div>
{:else}
	<StoreHome {config} {menu} lines={cart.lines} onadd={add} onstep={step} />
{/if}
