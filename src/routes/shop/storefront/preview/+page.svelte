<script lang="ts">
	import { onMount } from 'svelte';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Monitor from '@lucide/svelte/icons/monitor';
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import type { StoreCategory, StoreProduct } from '$lib/storefront/api';
	import { themeVars, type StoreTheme } from '$lib/storefront/theme';
	import { storefrontAdminApi, type AdminStorefront } from '$lib/storefront/admin';
	import { useStorefront } from '$lib/storefront/admin-context';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import '$lib/storefront/storefront.css';

	/**
	 * Store preview.
	 *
	 * Uses the authenticated admin preview endpoint so unpublished shops still
	 * see their menu. Renders with the real storefront stylesheet and tokens.
	 */
	let props: { config?: AdminStorefront } = $props();
	const ctx = useStorefront(() => props);
	const config = $derived(ctx.config);

	type View = 'phone' | 'desktop';
	let view = $state<View>('phone');
	let products = $state<StoreProduct[]>([]);
	let categories = $state<StoreCategory[]>([]);
	let loading = $state(true);
	let error = $state('');

	const sampleCategories: StoreCategory[] = [
		{ id: '1', name: 'Popular', description: 'Popular items', sort_order: 1, products: [] },
		{ id: '2', name: 'Mains', description: 'Main dishes', sort_order: 2, products: [] },
		{ id: '3', name: 'Drinks', description: 'Beverages', sort_order: 3, products: [] }
	];
	const sampleProducts: StoreProduct[] = [
		{
			id: '1',
			category_id: '1',
			name: 'House Special Veg Momo',
			description: 'Hand-folded steamed dumplings served with house dipping sauce',
			price: 120,
			is_available: true,
			is_vegetarian: true,
			is_featured: true,
			is_popular: true,
			allow_special_instructions: true,
			addons: [],
			sort_order: 1
		},
		{
			id: '2',
			category_id: '1',
			name: 'Crispy Fried Chicken Momo',
			description: 'Crispy outer shell filled with spiced minced chicken',
			price: 180,
			is_available: true,
			is_vegetarian: false,
			is_featured: false,
			is_popular: true,
			allow_special_instructions: true,
			addons: [],
			sort_order: 2
		},
		{
			id: '3',
			category_id: '2',
			name: 'Hakka Chili Garlic Noodles',
			description: 'Wok-tossed noodles with bell peppers and garlic chili oil',
			price: 150,
			is_available: true,
			is_vegetarian: true,
			is_featured: false,
			is_popular: false,
			allow_special_instructions: true,
			addons: [],
			sort_order: 3
		}
	];

	async function loadPreview() {
		loading = true;
		try {
			const data = await storefrontAdminApi.preview();
			categories = (data.categories ?? []) as StoreCategory[];
			products = ((data.products ?? []) as StoreProduct[]).filter((p) => p.is_available).slice(0, 6);
			error = '';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not load your live menu';
		} finally {
			loading = false;
		}
	}

	onMount(loadPreview);

	const displayCategories = $derived(categories.length > 0 ? categories : (error ? sampleCategories : []));
	const displayProducts = $derived(products.length > 0 ? products : (error ? sampleProducts : []));

	const theme = $derived<StoreTheme>({
		...config.theme,
		vars: config.theme.vars ?? {}
	});
	const vars = $derived(themeVars(theme));

	/** The frame width. Fixed pixels inside a scaled container. */
	const frameWidth = $derived(view === 'phone' ? 390 : 1100);
</script>

<div class="panel">
	<div class="panel-h" style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
		<div>
			<h2 style="margin:0;">Preview</h2>
			<p class="panel-note" style="margin:0.2rem 0 0;">
				Your live menu and theme, as a customer would see them — including when the store is unpublished.
			</p>
		</div>
		<div style="display:flex;align-items:center;gap:0.35rem;">
			<div class="tabs" role="tablist" aria-label="Preview width" style="padding:2px;">
				<button
					type="button"
					role="tab"
					aria-selected={view === 'phone'}
					onclick={() => (view = 'phone')}
				>
					<Smartphone size={14} strokeWidth={1.9} /> Phone
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={view === 'desktop'}
					onclick={() => (view = 'desktop')}
				>
					<Monitor size={14} strokeWidth={1.9} /> Desktop
				</button>
			</div>
			<a class="btn btn-secondary btn-sm" href="/" target="_blank" rel="noopener">
				<ExternalLink size={14} strokeWidth={2} /> Open live
			</a>
		</div>
	</div>

	{#if error}
		<div class="alert alert-danger" style="margin-top:1rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
			<div>
				<strong>Menu notice:</strong> {error} — showing preview layout with sample dishes.
			</div>
			<button class="btn btn-primary btn-sm" type="button" disabled={loading} onclick={loadPreview}>
				{loading ? 'Retrying…' : 'Try again'}
			</button>
		</div>
	{/if}

	{#if loading && categories.length === 0 && products.length === 0 && !error}
		<div style="margin-top:1rem;"><Skeleton height="420px" /></div>
	{:else}
		<div class="sfpreview" style="margin-top:1.1rem;">
			<div class="sfpreview-bar">
				<span class="sfpreview-dot"></span>
				<span class="sfpreview-dot"></span>
				<span class="sfpreview-dot"></span>
				<span class="sfpreview-url">{config.public_url || 'https://your-shop.orderly.local'}</span>
			</div>
			<div
				class="sfpreview-body sf-root"
				data-sf-theme={config.theme.mode === 'system' ? 'light' : config.theme.mode}
				style={vars}
			>
				<div style={`width:${frameWidth}px;max-width:100%;margin:0 auto;`}>
					<header class="sf-header">
						<div class="sf-header-row">
							<a class="sf-brand" href="#preview" onclick={(e) => e.preventDefault()}>
								{#if config.store.logo_url}
									<img class="sf-brand-logo" src={config.store.logo_url} alt="" />
								{:else}
									<span class="sf-brand-mark" aria-hidden="true">
										{(config.store.name || 'S').trim().charAt(0).toUpperCase()}
									</span>
								{/if}
								<span class="sf-brand-text">
									<span class="sf-brand-name">{config.store.name}</span>
									<span class="sf-brand-meta">
										<span class="sf-open-dot" data-open={String(config.ordering_available_now)}></span>
										{config.ordering_available_now ? 'Open' : 'Closed'}
									</span>
								</span>
							</a>
							<div class="sf-header-actions">
								<span class="sf-icon-btn" aria-hidden="true">
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
										<circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
									</svg>
								</span>
								<span class="sf-icon-btn" aria-hidden="true">
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
										<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" />
									</svg>
								</span>
							</div>
						</div>
					</header>

					{#if !config.ordering_available_now}
						<div class="sf-wrap" style="padding-top:12px;">
							<div class="sf-alert" data-tone="warn" role="status">
								{config.closed_reason || 'Currently Closed'}
							</div>
						</div>
					{/if}

					{#if config.theme.hero !== 'none'}
						<section class="sf-hero" data-style={config.theme.hero}>
							<div class="sf-hero-inner">
								<h1 style="font-size:1.375rem;">{config.store.name}</h1>
								{#if config.store.tagline}<p>{config.store.tagline}</p>{/if}
							</div>
						</section>
					{/if}

					<div style="padding-bottom:16px;">
						{#if displayCategories.length > 1}
							<div class="sf-categories" style="padding-top:12px;">
								{#each displayCategories as category (category.id)}
									<span class="sf-chip active">{category.name}</span>
								{/each}
							</div>
						{/if}

						{#if displayProducts.length === 0}
							<div class="sf-empty">
								<span class="sf-empty-icon" aria-hidden="true">
									<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
										<path d="M3 11h18M5 11v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
									</svg>
								</span>
								<h3 style="font-size:0.9375rem;">No items published</h3>
								<p style="font-size:0.8125rem;">
									Add a category and some products in <a href="/shop/menu" style="color:var(--sf-primary);">Menu</a>.
								</p>
							</div>
						{:else}
							<div class="sf-section">
								<div class="sf-section-head" style="padding-inline:var(--sf-gutter);">
									<h2 style="font-size:0.9375rem;">Full menu</h2>
								</div>
								<div class="sf-wrap">
									<div class="sf-products" data-columns="true">
										{#each displayProducts as product (product.id)}
											<article class="sf-product">
												<span class="sf-product-media">
													{#if product.image_url}
														<img src={product.image_url} alt="" loading="lazy" />
													{/if}
												</span>
												<span class="sf-product-body">
													<span class="sf-product-name">
														{product.name}
														{#if product.is_vegetarian}
															<span class="sf-veg-mark" title="Vegetarian" aria-label="Vegetarian">
																<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5">
																	<path d="M20 6 9 17l-5-5" />
																</svg>
															</span>
														{/if}
													</span>
													{#if product.description}
														<span class="sf-product-desc">{product.description}</span>
													{/if}
													<span class="sf-product-foot">
														<span class="sf-product-price">₹{product.price}</span>
														{#if product.addons?.length > 0}
															<span class="sf-tag">Options</span>
														{/if}
													</span>
												</span>
											</article>
										{/each}
									</div>
								</div>
							</div>
						{/if}

						{#if config.store.address || config.store.phone}
							<div class="sf-section">
								<div class="sf-section-head"><h2 style="font-size:0.9375rem;">Where to find us</h2></div>
								<div class="sf-wrap">
									<div class="sf-panel">
										<div class="sf-info-list">
											{#if config.store.address}
												<div class="sf-info-row">
													<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
														<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
													</svg>
													<span>{config.store.address}</span>
												</div>
											{/if}
											{#if config.store.phone}
												<div class="sf-info-row">
													<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
														<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
													</svg>
													<span>{config.store.phone}</span>
												</div>
											{/if}
										</div>
									</div>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<p class="field-hint" style="margin-top:0.8rem;">
			This preview uses your admin menu. It looks empty until you add at least one available product.
		</p>
	{/if}
</div>
