<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import UtensilsCrossed from '@tabler/icons-svelte/icons/tools-kitchen-2';
	import { useCart } from '$lib/storefront/cart-state.svelte';
	import { lineKey } from '$lib/storefront/cart.svelte';
	import ProductCard from '$lib/storefront/ProductCard.svelte';
	import StoreHome from '$lib/storefront/StoreHome.svelte';
	import BookHome from '$lib/storefront/BookHome.svelte';
	import StayHome from '$lib/storefront/StayHome.svelte';
	import type { StoreProduct } from '$lib/storefront/api';
	import { cardShape, experienceFor } from '$lib/storefront/experience';

	/**
	 * The storefront home page.
	 *
	 * Which home a business gets (shop, booking or stay) comes from its type
	 * and capabilities; what a shop's home shows comes from its saved layout.
	 * The page itself decides nothing about what a business should show.
	 */
	let { data } = $props();

	const cart = useCart();
	const config = $derived(data.config);
	const menu = $derived(data.menu);
	const query = $derived($page.url.searchParams.get('q')?.trim() ?? '');
	const exp = $derived(experienceFor(config));
	const layout = $derived(cardShape(exp, config?.theme?.product_layout ?? 'list'));

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
{:else if exp.family === 'book'}
	<BookHome {config} {exp} services={data.services} staff={data.staff} error={data.menuError} />
{:else if exp.family === 'stay'}
	<StayHome {config} {exp} roomTypes={data.roomTypes} search={data.stay} error={data.menuError} />
{:else if !menu}
	<div class="sf-wrap" style="padding-top:28px;">
		<div class="sf-empty">
			<span class="sf-empty-icon" aria-hidden="true">
				<UtensilsCrossed size={26} stroke={1.6} />
			</span>
			<h3>{exp.words.catalog} unavailable</h3>
			<p>{data.menuError || `This store has not published its ${exp.words.catalog.toLowerCase()} yet.`}</p>
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
					<UtensilsCrossed size={26} stroke={1.6} />
				</span>
				<h3>Nothing matched</h3>
				<p>Try a different word, or browse the full {exp.words.catalog.toLowerCase()}.</p>
				<a class="sf-btn sf-btn-secondary" href="/menu">Browse the {exp.words.catalog.toLowerCase()}</a>
			</div>
		{:else}
			<div class="sf-products results" data-layout={layout}>
				{#each matches as product (product.id)}
					<ProductCard
						{product}
						{layout}
						{exp}
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
	<StoreHome {config} {menu} {exp} lines={cart.lines} onadd={add} onstep={step} />
{/if}

<style>
	.results[data-layout='tile'] {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 24px 14px;
	}
	.results[data-layout='spec'] > :global(.pc) {
		border-bottom: 1px solid var(--sf-border);
	}
</style>
