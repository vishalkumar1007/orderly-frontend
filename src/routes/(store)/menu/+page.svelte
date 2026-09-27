<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
	import X from '@lucide/svelte/icons/x';
	import ProductCard from '$lib/storefront/ProductCard.svelte';
	import { useCart } from '$lib/storefront/cart-state.svelte';
	import { lineKey } from '$lib/storefront/cart.svelte';
	import type { StoreProduct } from '$lib/storefront/api';

	/**
	 * Full menu with sticky filters.
	 *
	 * Category, dietary and merchandising filters hide products (they do not
	 * only jump). Layout and filter chrome come from the tenant theme tokens.
	 */
	let { data } = $props();

	const cart = useCart();
	const config = $derived(data.config);
	const menu = $derived(data.menu);
	const query = $derived($page.url.searchParams.get('q')?.trim() ?? '');
	const layout = $derived(config?.theme?.product_layout ?? 'list');
	const filterStyle = $derived(config?.theme?.filter_style ?? 'chips');

	type DietFilter = 'all' | 'veg' | 'nonveg';
	type FlagFilter = 'all' | 'popular' | 'featured';

	let categoryId = $state('all');
	let diet = $state<DietFilter>('all');
	let flag = $state<FlagFilter>('all');
	let availableOnly = $state(false);
	let sheetOpen = $state(false);

	const filtered = $derived.by(() => {
		if (!menu) return [] as StoreProduct[];
		let list = menu.products;
		if (query) {
			const needle = query.toLowerCase();
			list = list.filter(
				(p) =>
					p.name.toLowerCase().includes(needle) ||
					(p.description ?? '').toLowerCase().includes(needle)
			);
		}
		if (categoryId !== 'all') {
			list = list.filter((p) => p.category_id === categoryId);
		}
		if (diet === 'veg') list = list.filter((p) => p.is_vegetarian);
		if (diet === 'nonveg') list = list.filter((p) => !p.is_vegetarian);
		if (flag === 'popular') list = list.filter((p) => p.is_popular);
		if (flag === 'featured') list = list.filter((p) => p.is_featured);
		if (availableOnly) list = list.filter((p) => p.is_available);
		return list;
	});

	const grouped = $derived.by(() => {
		if (!menu) return [];
		if (categoryId !== 'all' || query) {
			return [{ id: 'results', name: query ? `Results for “${query}”` : 'Menu', products: filtered }];
		}
		return menu.categories
			.map((c) => ({
				id: c.id,
				name: c.name,
				description: c.description,
				products: filtered.filter((p) => p.category_id === c.id)
			}))
			.filter((c) => c.products.length > 0);
	});

	const activeFilterCount = $derived(
		(categoryId !== 'all' ? 1 : 0) +
			(diet !== 'all' ? 1 : 0) +
			(flag !== 'all' ? 1 : 0) +
			(availableOnly ? 1 : 0)
	);

	function add(product: StoreProduct) {
		cart.add(product, 1);
	}

	function step(product: StoreProduct, delta: number) {
		cart.step(lineKey(product.id, []), delta);
	}

	function clearFilters() {
		categoryId = 'all';
		diet = 'all';
		flag = 'all';
		availableOnly = false;
		sheetOpen = false;
		if (query) void goto('/menu', { replaceState: true });
	}

	function setCategory(id: string) {
		categoryId = id;
	}
</script>

{#if !menu}
	<div class="sf-wrap sf-menu-pad">
		<div class="sf-empty">
			<span class="sf-empty-icon" aria-hidden="true">
				<UtensilsCrossed size={26} strokeWidth={1.7} />
			</span>
			<h3>Menu unavailable</h3>
			<p>{data.menuError || 'This store has not published its menu yet.'}</p>
		</div>
	</div>
{:else}
	<div class="sf-menu" data-filter-style={filterStyle} data-layout={layout}>
		<aside class="sf-menu-rail" aria-label="Filters">
			<div class="sf-filter-panel">
				<div class="sf-filter-panel-head">
					<h2>Filters</h2>
					{#if activeFilterCount > 0}
						<button class="sf-filter-clear" type="button" onclick={clearFilters}>Clear</button>
					{/if}
				</div>
				<div class="sf-filter-group">
					<span class="sf-filter-label">Category</span>
					<div class="sf-filter-bar" data-style={filterStyle} data-wrap="true">
						<button
							class="sf-filter-chip"
							type="button"
							data-active={String(categoryId === 'all')}
							onclick={() => setCategory('all')}>All</button
						>
						{#each menu.categories as category (category.id)}
							<button
								class="sf-filter-chip"
								type="button"
								data-active={String(categoryId === category.id)}
								onclick={() => setCategory(category.id)}>{category.name}</button
							>
						{/each}
					</div>
				</div>
				<div class="sf-filter-group">
					<span class="sf-filter-label">Diet</span>
					<div class="sf-filter-bar" data-style={filterStyle} data-wrap="true">
						<button class="sf-filter-chip" type="button" data-active={String(diet === 'all')} onclick={() => (diet = 'all')}>Any</button>
						<button class="sf-filter-chip" type="button" data-active={String(diet === 'veg')} onclick={() => (diet = 'veg')}>Veg</button>
						<button class="sf-filter-chip" type="button" data-active={String(diet === 'nonveg')} onclick={() => (diet = 'nonveg')}>Non-veg</button>
					</div>
				</div>
				<div class="sf-filter-group">
					<span class="sf-filter-label">Highlights</span>
					<div class="sf-filter-bar" data-style={filterStyle} data-wrap="true">
						<button class="sf-filter-chip" type="button" data-active={String(flag === 'all')} onclick={() => (flag = 'all')}>All</button>
						<button class="sf-filter-chip" type="button" data-active={String(flag === 'popular')} onclick={() => (flag = 'popular')}>Popular</button>
						<button class="sf-filter-chip" type="button" data-active={String(flag === 'featured')} onclick={() => (flag = 'featured')}>Featured</button>
					</div>
				</div>
				<label class="sf-filter-toggle">
					<input type="checkbox" bind:checked={availableOnly} />
					<span>Available only</span>
				</label>
			</div>
		</aside>

		<div class="sf-menu-main">
			<div class="sf-filter-sticky">
				<nav class="sf-filter-bar" data-style={filterStyle} aria-label="Quick filters">
					<button class="sf-filter-chip" type="button" data-active={String(categoryId === 'all' && diet === 'all' && flag === 'all')} onclick={() => { categoryId = 'all'; diet = 'all'; flag = 'all'; }}>All</button>
					{#each menu.categories as category (category.id)}
						<button
							class="sf-filter-chip"
							type="button"
							data-active={String(categoryId === category.id)}
							onclick={() => setCategory(category.id)}>{category.name}</button
						>
					{/each}
					<span class="sf-filter-sep" aria-hidden="true"></span>
					<button class="sf-filter-chip" type="button" data-active={String(diet === 'veg')} onclick={() => (diet = diet === 'veg' ? 'all' : 'veg')}>Veg</button>
					<button class="sf-filter-chip" type="button" data-active={String(diet === 'nonveg')} onclick={() => (diet = diet === 'nonveg' ? 'all' : 'nonveg')}>Non-veg</button>
					<button class="sf-filter-chip" type="button" data-active={String(flag === 'popular')} onclick={() => (flag = flag === 'popular' ? 'all' : 'popular')}>Popular</button>
					<button class="sf-filter-chip" type="button" data-active={String(flag === 'featured')} onclick={() => (flag = flag === 'featured' ? 'all' : 'featured')}>Featured</button>
					<button
						class="sf-filter-more"
						type="button"
						aria-expanded={sheetOpen}
						onclick={() => (sheetOpen = !sheetOpen)}
					>
						<SlidersHorizontal size={15} strokeWidth={2.2} aria-hidden="true" />
						{#if activeFilterCount > 0}
							<span class="sf-filter-more-badge">{activeFilterCount}</span>
						{/if}
					</button>
				</nav>

				{#if sheetOpen}
					<div class="sf-filter-sheet" role="dialog" aria-label="More filters">
						<div class="sf-filter-sheet-head">
							<strong>More filters</strong>
							<button class="sf-icon-btn" type="button" aria-label="Close filters" onclick={() => (sheetOpen = false)}>
								<X size={18} strokeWidth={2} />
							</button>
						</div>
						<label class="sf-filter-toggle">
							<input type="checkbox" bind:checked={availableOnly} />
							<span>Available only</span>
						</label>
						{#if activeFilterCount > 0 || query}
							<button class="sf-btn sf-btn-secondary sf-filter-sheet-clear" type="button" onclick={clearFilters}>
								Clear all filters
							</button>
						{/if}
					</div>
				{/if}
			</div>

			<div class="sf-wrap sf-menu-pad">
				{#if query || activeFilterCount > 0}
					<div class="sf-section-head sf-menu-result-head">
						<h2>
							{filtered.length} item{filtered.length === 1 ? '' : 's'}
							{#if query} for “{query}”{/if}
						</h2>
						<button class="sf-filter-clear" type="button" onclick={clearFilters}>Clear</button>
					</div>
				{/if}

				{#if filtered.length === 0}
					<div class="sf-empty">
						<span class="sf-empty-icon" aria-hidden="true">
							<UtensilsCrossed size={26} strokeWidth={1.7} />
						</span>
						<h3>Nothing matched</h3>
						<p>Try clearing a filter, or browse every category.</p>
						<button class="sf-btn sf-btn-primary" type="button" onclick={clearFilters}>Clear filters</button>
					</div>
				{:else}
					{#each grouped as group (group.id)}
						<section class="sf-menu-section" id={group.id}>
							<div class="sf-section-head sf-menu-section-head">
								<h2>{group.name}</h2>
								<span class="sf-menu-count">{group.products.length}</span>
							</div>
							{#if 'description' in group && group.description}
								<p class="sf-menu-section-desc">{group.description}</p>
							{/if}
							<div class="sf-products" data-layout={layout}>
								{#each group.products as product (product.id)}
									<ProductCard
										{product}
										{layout}
										currency={config?.store?.currency ?? 'INR'}
										inCart={cart.quantityOf(product.id)}
										orderable={config?.ordering.enabled ?? false}
										onadd={add}
										onstep={step}
									/>
								{/each}
							</div>
						</section>
					{/each}
				{/if}
			</div>
		</div>
	</div>
{/if}
