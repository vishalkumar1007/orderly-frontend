<script lang="ts">
	import { onMount } from 'svelte';
	import Clock from '@lucide/svelte/icons/clock';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Image from '@lucide/svelte/icons/image';
	import LayoutTemplate from '@lucide/svelte/icons/layout-template';
	import Monitor from '@lucide/svelte/icons/monitor';
	import Palette from '@lucide/svelte/icons/palette';
	import QrCode from '@lucide/svelte/icons/qr-code';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import { api } from '$lib/api/client';
	import type { StoreCategory, StoreProduct } from '$lib/storefront/api';
	import { themeVars, type StoreTheme } from '$lib/storefront/theme';
	import { storefrontAdminApi } from '$lib/storefront/admin';
	import { useStorefront, type StorefrontContext } from '$lib/storefront/admin-context';
	import { errorMessage } from '$lib/admin/errors';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import { toast } from '$lib/components/admin/toast';
	import '$lib/storefront/storefront.css';

	/**
	 * Preview, with the controls that decide what it shows.
	 *
	 * Looking at the storefront and changing whether customers can reach it are
	 * the same task: you publish because of what you just saw, and you check
	 * what you just changed. Splitting them across two screens meant navigating
	 * away from the only thing that tells you whether the change was right.
	 *
	 * The controls here are the two that decide whether a customer can order at
	 * all — published, and accepting orders. Everything that shapes the look
	 * keeps its own screen under Customize and is one tap away.
	 */
	let props: Partial<StorefrontContext> = $props();
	const ctx = useStorefront(() => props);
	const config = $derived(ctx.config);
	const save = (run: Parameters<StorefrontContext['save']>[0]) => ctx.save(run);

	type View = 'phone' | 'desktop';
	let view = $state<View>('phone');
	let products = $state<StoreProduct[]>([]);
	let categories = $state<StoreCategory[]>([]);
	let loading = $state(true);
	let error = $state('');
	let publishing = $state(false);
	let togglingOrdering = $state(false);

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

	const displayCategories = $derived(
		categories.length > 0 ? categories : error ? sampleCategories : []
	);
	const displayProducts = $derived(products.length > 0 ? products : error ? sampleProducts : []);

	const theme = $derived<StoreTheme>({
		...config.theme,
		vars: config.theme.vars ?? {}
	});
	const vars = $derived(themeVars(theme));

	/** The frame width. Fixed pixels inside a scaled container. */
	const frameWidth = $derived(view === 'phone' ? 390 : 1100);

	const published = $derived(config.behaviour.published);
	const orderingEnabled = $derived(config.behaviour.ordering_enabled);

	/**
	 * Why a customer cannot order right now, in the order the shop can act on.
	 * `ordering_available_now` is the server's verdict; this explains it.
	 */
	const blocker = $derived.by(() => {
		if (!published) return 'Your storefront is not published, so nobody can reach it.';
		if (!orderingEnabled) return 'Ordering is switched off. Customers can browse but not check out.';
		if (!config.hours.is_open)
			return config.closed_reason || `Outside opening hours — ${config.hours.label}.`;
		return '';
	});

	async function togglePublish() {
		if (publishing) return;
		publishing = true;
		try {
			await api<{ is_published: boolean }>(published ? '/api/v1/tenant/unpublish' : '/api/v1/tenant/publish', {
				method: 'POST'
			});
			// Re-read rather than flipping the flag by hand: publishing can change
			// more than one field, and the preview beside this must agree with it.
			await ctx.refresh();
			toast.success(published ? 'Store unpublished' : 'Your store is live');
		} catch (err) {
			toast.error(errorMessage(err, published ? 'unpublish your store' : 'publish your store'));
			await ctx.refresh();
		} finally {
			publishing = false;
		}
	}

	async function toggleOrdering(next: boolean) {
		if (togglingOrdering) return;
		togglingOrdering = true;
		const ok = await save(() => storefrontAdminApi.saveBehaviour({ ordering_enabled: next }));
		togglingOrdering = false;
		if (ok) toast.success(next ? 'Accepting orders' : 'Ordering switched off');
		else toast.error('Could not change whether you are accepting orders');
	}

	const shortcuts = [
		{ href: '/shop/customize/branding', label: 'Branding', icon: Image },
		{ href: '/shop/customize/theme', label: 'Theme', icon: Palette },
		{ href: '/shop/customize/homepage', label: 'Homepage', icon: LayoutTemplate },
		{ href: '/shop/storefront/hours', label: 'Opening hours', icon: Clock },
		{ href: '/shop/storefront/qr', label: 'QR & Share', icon: QrCode }
	];
</script>

<div class="pv-shell">
	<aside class="pv-controls" aria-label="Storefront controls">
		<div class="panel pv-panel">
			<h2 class="panel-h">Status</h2>
			<p class="panel-note">Who can reach your shop, and whether they can order.</p>

			<!-- Keyed on the server's answer: a write that fails must leave the
			     toggle showing what is actually true, not what was clicked. -->
			<div class="pv-switches">
				{#key published}
					<Switch
						checked={published}
						disabled={publishing}
						label="Published"
						hint={published
							? 'Anyone with your link can browse and order.'
							: 'Hidden. Only you can see it.'}
						onchange={togglePublish}
					/>
				{/key}
				{#key orderingEnabled}
					<Switch
						checked={orderingEnabled}
						disabled={togglingOrdering}
						label="Accepting orders"
						hint={orderingEnabled
							? 'The cart and checkout are available.'
							: 'Browsing stays on; the cart is hidden.'}
						onchange={toggleOrdering}
					/>
				{/key}
			</div>

			<div class="pv-state" data-open={String(config.ordering_available_now)}>
				<span class="pv-state-dot" aria-hidden="true"></span>
				<span>
					<strong>{config.ordering_available_now ? 'Taking orders now' : 'Not taking orders'}</strong>
					<span class="pv-state-note">
						{blocker || config.hours.detail || config.hours.label}
					</span>
				</span>
			</div>
		</div>

		<div class="panel pv-panel">
			<h2 class="panel-h">Change what you see</h2>
			<ul class="pv-links">
				{#each shortcuts as item (item.href)}
					<li>
						<a class="pv-link" href={item.href}>
							<span class="pv-link-icon" aria-hidden="true">
								<item.icon size={15} strokeWidth={1.9} />
							</span>
							{item.label}
						</a>
					</li>
				{/each}
			</ul>
		</div>
	</aside>

	<div class="pv-stage">
		<div class="panel">
			<div class="pv-bar">
				<div>
					<h2 class="panel-h" style="margin:0;">Preview</h2>
					<p class="panel-note" style="margin:0.2rem 0 0;">
						Your live menu and theme, as a customer would see them — including while the store is
						unpublished.
					</p>
				</div>
				<div class="pv-bar-actions">
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
					<button
						class="btn btn-ghost btn-sm"
						type="button"
						disabled={loading}
						onclick={loadPreview}
						aria-label="Reload the preview"
					>
						<RefreshCw size={14} strokeWidth={2} />
					</button>
					<a
						class="btn btn-secondary btn-sm"
						href={config.public_url || '/'}
						target="_blank"
						rel="noopener"
					>
						<ExternalLink size={14} strokeWidth={2} /> Open live
					</a>
				</div>
			</div>

			{#if error}
				<div class="alert alert-danger pv-alert">
					<div>
						<strong>Menu notice:</strong>
						{error} — showing preview layout with sample dishes.
					</div>
					<button
						class="btn btn-primary btn-sm"
						type="button"
						disabled={loading}
						onclick={loadPreview}
					>
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
						<span class="sfpreview-url">
							{config.public_url || 'https://your-shop.orderly.local'}
						</span>
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
												<span
													class="sf-open-dot"
													data-open={String(config.ordering_available_now)}
												></span>
												{config.ordering_available_now ? 'Open' : 'Closed'}
											</span>
										</span>
									</a>
									<div class="sf-header-actions">
										<span class="sf-icon-btn" aria-hidden="true">
											<svg
												width="20"
												height="20"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="1.9"
											>
												<circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
											</svg>
										</span>
										<span class="sf-icon-btn" aria-hidden="true">
											<svg
												width="20"
												height="20"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="1.9"
											>
												<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path
													d="M3 6h18"
												/>
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
											<svg
												width="24"
												height="24"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="1.6"
											>
												<path d="M3 11h18M5 11v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
											</svg>
										</span>
										<h3 style="font-size:0.9375rem;">No items published</h3>
										<p style="font-size:0.8125rem;">
											Add a category and some products in
											<a href="/shop/menu" style="color:var(--sf-primary);">Menu</a>.
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
																	<span
																		class="sf-veg-mark"
																		title="Vegetarian"
																		aria-label="Vegetarian"
																	>
																		<svg
																			width="9"
																			height="9"
																			viewBox="0 0 24 24"
																			fill="none"
																			stroke="currentColor"
																			stroke-width="3.5"
																		>
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
										<div class="sf-section-head">
											<h2 style="font-size:0.9375rem;">Where to find us</h2>
										</div>
										<div class="sf-wrap">
											<div class="sf-panel">
												<div class="sf-info-list">
													{#if config.store.address}
														<div class="sf-info-row">
															<svg
																width="17"
																height="17"
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																stroke-width="1.9"
															>
																<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle
																	cx="12"
																	cy="10"
																	r="3"
																/>
															</svg>
															<span>{config.store.address}</span>
														</div>
													{/if}
													{#if config.store.phone}
														<div class="sf-info-row">
															<svg
																width="17"
																height="17"
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																stroke-width="1.9"
															>
																<path
																	d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"
																/>
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
					This preview uses your admin menu. It looks empty until you add at least one available
					product.
				</p>
			{/if}
		</div>
	</div>
</div>

<style>
	.pv-shell {
		display: grid;
		gap: 1.25rem;
		align-items: start;
	}

	@media (min-width: 1100px) {
		.pv-shell {
			grid-template-columns: 19rem minmax(0, 1fr);
		}

		.pv-controls {
			position: sticky;
			top: calc(var(--topbar-h) + 1rem);
		}
	}

	.pv-controls {
		display: grid;
		gap: 1rem;
		align-content: start;
	}

	.pv-panel {
		padding-bottom: 1.05rem;
	}

	.pv-switches {
		display: grid;
		gap: 0.75rem;
		margin-top: 0.9rem;
	}

	.pv-state {
		display: flex;
		align-items: flex-start;
		gap: 0.55rem;
		margin-top: 1rem;
		padding: 0.7rem 0.8rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		font-size: 0.82rem;
		line-height: 1.45;
	}

	.pv-state strong {
		display: block;
		color: var(--text);
		font-weight: 600;
	}

	.pv-state-note {
		display: block;
		color: var(--text-3);
		font-size: 0.75rem;
	}

	.pv-state-dot {
		flex: none;
		width: 0.55rem;
		height: 0.55rem;
		margin-top: 0.3rem;
		border-radius: 999px;
		background: var(--danger);
	}

	.pv-state[data-open='true'] .pv-state-dot {
		background: var(--success);
	}

	.pv-links {
		list-style: none;
		margin: 0.85rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.2rem;
	}

	.pv-link {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.5rem 0.55rem;
		border-radius: 8px;
		color: var(--text-2);
		font-size: 0.85rem;
		text-decoration: none;
		transition:
			background var(--tr),
			color var(--tr);
	}

	.pv-link:hover {
		background: var(--surface-2);
		color: var(--text);
	}

	.pv-link-icon {
		display: grid;
		place-items: center;
		width: 1.7rem;
		height: 1.7rem;
		flex: none;
		border-radius: 7px;
		background: var(--surface-2);
	}

	.pv-link:hover .pv-link-icon {
		background: var(--accent-soft);
		color: var(--accent-dark);
	}

	.pv-bar {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.pv-bar-actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.pv-alert {
		margin-top: 1rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
</style>
