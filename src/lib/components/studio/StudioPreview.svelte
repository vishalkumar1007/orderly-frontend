<script lang="ts">
	import { onMount } from 'svelte';
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import Monitor from '@lucide/svelte/icons/monitor';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Star from '@lucide/svelte/icons/star';
	import Clock from '@lucide/svelte/icons/clock';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Search from '@lucide/svelte/icons/search';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Plus from '@lucide/svelte/icons/plus';
	import Minus from '@lucide/svelte/icons/minus';
	import type { AdminStorefront } from '$lib/storefront/admin';
	import { storefrontAdminApi } from '$lib/storefront/admin';
	import { themeVars, fontImportFor, type StoreTheme } from '$lib/storefront/theme';
	import { PREVIEW_CATALOGS } from '$lib/storefront/previewCatalogs';
	import type { StoreCategory, StoreProduct } from '$lib/storefront/api';
	import ProductCard from '$lib/storefront/ProductCard.svelte';
	import '$lib/storefront/storefront.css';

	let { config }: { config: AdminStorefront } = $props();

	type DeviceMode = 'mobile' | 'desktop';
	let device = $state<DeviceMode>('mobile');

	type CatalogSource = 'LIVE' | 'BAKERY' | 'CAFE' | 'RETAIL' | 'SERVICE';
	let catalogSource = $state<CatalogSource>('LIVE');

	let liveCategories = $state<StoreCategory[]>([]);
	let liveProducts = $state<StoreProduct[]>([]);
	let loadingLive = $state(false);

	// Client-side interactive cart simulation for live testing
	let cart = $state<Record<string, number>>({});
	let activeCategory = $state<string>('');
	let searchQuery = $state('');

	async function loadLiveMenu() {
		loadingLive = true;
		try {
			const data = await storefrontAdminApi.preview();
			liveCategories = (data.categories ?? []) as StoreCategory[];
			liveProducts = ((data.products ?? []) as StoreProduct[]).filter((p) => p.is_available);
		} catch {
			// fallback to restaurant catalog
		} finally {
			loadingLive = false;
		}
	}

	onMount(() => {
		void loadLiveMenu();
	});

	// Resolved categories & products according to selected catalog source or business type
	const resolvedCatalog = $derived.by(() => {
		if (catalogSource === 'LIVE' && liveProducts.length > 0) {
			return {
				type: config.store.business_type || 'RESTAURANT',
				categories: liveCategories,
				products: liveProducts
			};
		}
		const fallbackKey = catalogSource === 'LIVE' ? (config.store.business_type || 'RESTAURANT') : catalogSource;
		const sample = PREVIEW_CATALOGS[fallbackKey] || PREVIEW_CATALOGS.RESTAURANT;
		return {
			type: sample.type,
			categories: sample.categories,
			products: sample.products
		};
	});

	const categories = $derived(resolvedCatalog.categories);
	const allProducts = $derived(resolvedCatalog.products);

	const filteredProducts = $derived.by(() => {
		let list = allProducts;
		if (activeCategory) {
			list = list.filter((p) => p.category_id === activeCategory);
		}
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			list = list.filter(
				(p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
			);
		}
		return list;
	});

	const cartItemCount = $derived(Object.values(cart).reduce((a, b) => a + b, 0));
	const cartSubtotal = $derived.by(() => {
		return Object.entries(cart).reduce((sum, [id, qty]) => {
			const p = allProducts.find((item) => item.id === id);
			return sum + (p ? p.price * qty : 0);
		}, 0);
	});

	function addToCart(p: StoreProduct) {
		cart[p.id] = (cart[p.id] || 0) + 1;
	}

	function stepCart(p: StoreProduct, delta: number) {
		const current = cart[p.id] || 0;
		const next = current + delta;
		if (next <= 0) {
			delete cart[p.id];
		} else {
			cart[p.id] = next;
		}
	}

	const theme = $derived<StoreTheme>({
		...config.theme,
		vars: config.theme.vars ?? {}
	});
	const styleVars = $derived(themeVars(theme));
	const fontImportUrl = $derived(fontImportFor(theme.font));

	// Business agnostic badges & copy
	const bType = $derived(config.store.business_type || 'RESTAURANT');
	const verifiedTitle = $derived(
		bType === 'BAKERY'
			? 'Verified Bakery'
			: bType === 'CAFE'
				? 'Verified Cafe'
				: bType === 'RETAIL'
					? 'Verified Merchant'
					: bType === 'SERVICE'
						? 'Verified Studio'
						: 'Verified Kitchen'
	);
	const fulfillmentLabel = $derived(
		bType === 'SERVICE'
			? 'In-Studio / By Appointment'
			: bType === 'RETAIL'
				? 'In-Store Pickup & Delivery'
				: 'Takeaway / Pickup'
	);

	// Homepage sections derived
	const sections = $derived(config.homepage?.sections ?? []);
	const announcementSec = $derived(sections.find((s) => s.type === 'ANNOUNCEMENT' && s.enabled));
	const heroSec = $derived(sections.find((s) => s.type === 'HERO' && s.enabled));
	const categoriesSec = $derived(sections.find((s) => s.type === 'CATEGORIES' && s.enabled));
	const menuSec = $derived(sections.find((s) => s.type === 'MENU' && s.enabled));
	const businessSec = $derived(sections.find((s) => s.type === 'BUSINESS_INFO' && s.enabled));
	const hoursSec = $derived(sections.find((s) => s.type === 'OPENING_HOURS' && s.enabled));
	const footerSec = $derived(sections.find((s) => s.type === 'FOOTER' && s.enabled));

	const frameWidth = $derived(device === 'mobile' ? 390 : '100%');
</script>

<svelte:head>
	{#if fontImportUrl}
		<link rel="stylesheet" href={fontImportUrl} />
	{/if}
</svelte:head>

<div class="studio-preview-pane">
	<!-- Top Preview Control Bar -->
	<div class="studio-preview-bar">
		<div class="studio-device-switcher">
			<button
				type="button"
				class="studio-device-btn"
				class:active={device === 'mobile'}
				onclick={() => (device = 'mobile')}
				title="Mobile View (390px)"
			>
				<Smartphone size={15} strokeWidth={2} />
				<span>Mobile</span>
			</button>
			<button
				type="button"
				class="studio-device-btn"
				class:active={device === 'desktop'}
				onclick={() => (device = 'desktop')}
				title="Desktop Responsive View"
			>
				<Monitor size={15} strokeWidth={2} />
				<span>Desktop</span>
			</button>
		</div>

		<!-- Business Catalog Switcher -->
		<div class="studio-catalog-select-wrap">
			<span class="studio-catalog-label">Preview Data:</span>
			<select
				class="studio-catalog-select"
				value={catalogSource}
				onchange={(e) => (catalogSource = e.currentTarget.value as CatalogSource)}
			>
				<option value="LIVE">Store Menu {liveProducts.length ? `(${liveProducts.length})` : ''}</option>
				<option value="BAKERY">🥐 Bakery Sample</option>
				<option value="CAFE">☕ Cafe Sample</option>
				<option value="RETAIL">🛍️ Retail Sample</option>
				<option value="SERVICE">✂️ Service Sample</option>
			</select>
		</div>

		<!-- External Link to Live Public Store -->
		<div class="studio-preview-actions">
			{#if config.public_url}
				<a
					class="studio-live-link"
					href={config.public_url}
					target="_blank"
					rel="noopener"
					title="Open live storefront"
				>
					<ExternalLink size={13} strokeWidth={2} />
					<span>Visit Live Store</span>
				</a>
			{/if}
		</div>
	</div>

	<!-- Preview Stage -->
	<div class="studio-preview-stage" class:desktop-stage={device === 'desktop'}>
		<div
			class="studio-device-shell"
			class:mobile-shell={device === 'mobile'}
			class:desktop-shell={device === 'desktop'}
			style="width: {typeof frameWidth === 'number' ? frameWidth + 'px' : frameWidth};"
		>
			{#if device === 'mobile'}
				<!-- Mobile Bezel Top Notch / Status -->
				<div class="mobile-speaker-notch">
					<div class="mobile-speaker"></div>
				</div>
			{/if}

			<!-- REAL STOREFRONT CONTAINER WITH REAL THEME TOKENS -->
			<div
				class="sf-root sf-preview-root"
				data-sf-theme={config.theme.mode === 'system' ? 'light' : config.theme.mode}
				style={styleVars}
			>
				<!-- Storefront Header -->
				<header class="sf-header">
					<div class="sf-header-row">
						<div class="sf-brand">
							{#if config.store.logo_url}
								<img class="sf-brand-logo" src={config.store.logo_url} alt={config.store.name} />
							{:else}
								<span class="sf-brand-mark" aria-hidden="true">
									{(config.store.name || 'S').trim().charAt(0).toUpperCase()}
								</span>
							{/if}
							<div class="sf-brand-text">
								<span class="sf-brand-name">{config.store.name || 'Your Store'}</span>
								<span class="sf-brand-meta">
									<span
										class="sf-open-dot"
										data-open={String(config.ordering_available_now)}
									></span>
									{config.ordering_available_now ? 'Open Now' : 'Closed'}
								</span>
							</div>
						</div>

						<div class="sf-header-actions">
							<!-- Search Input Trigger -->
							<div class="sf-preview-search-input">
								<Search size={14} strokeWidth={2} class="sf-search-icon" />
								<input
									type="text"
									placeholder="Search items…"
									bind:value={searchQuery}
									class="sf-header-search-field"
								/>
							</div>

							<!-- Customer Bag Icon -->
							<button type="button" class="sf-icon-btn sf-bag-btn" aria-label="Cart">
								<ShoppingBag size={18} strokeWidth={2} />
								{#if cartItemCount > 0}
									<span class="sf-bag-badge">{cartItemCount}</span>
								{/if}
							</button>
						</div>
					</div>
				</header>

				<!-- Announcement Banner -->
				{#if announcementSec && announcementSec.content?.text}
					<div
						class="sf-announcement"
						data-tone={announcementSec.content?.tone || 'info'}
					>
						<Sparkles size={14} strokeWidth={2.2} />
						<span>{announcementSec.content.text}</span>
					</div>
				{/if}

				<!-- Hero Section -->
				{#if heroSec && config.theme.hero !== 'none'}
					<section
						class="sf-hero"
						data-style={config.theme.hero}
						style={config.theme.hero === 'image' && config.theme.hero_image_url
							? `background-image: linear-gradient(180deg, rgba(15,23,42,0.3) 0%, rgba(15,23,42,0.85) 100%), url('${config.theme.hero_image_url}'); background-size: cover; background-position: center;`
							: undefined}
					>
						<div class="sf-hero-inner">
							<div class="sf-hero-badge-row">
								<span class="sf-verified-badge" title={verifiedTitle}>
									<ShieldCheck size={16} strokeWidth={2.4} />
									<span>{verifiedTitle}</span>
								</span>
								<span class="sf-pill sf-pill-rating">
									<Star size={13} strokeWidth={2.6} />
									<span class="sf-pill-bold">4.9</span>
								</span>
								{#if config.behaviour.prep_time_minutes}
									<span class="sf-pill sf-pill-prep">
										<Clock size={13} strokeWidth={2.2} />
										<span>~{config.behaviour.prep_time_minutes}m</span>
									</span>
								{/if}
								<span class="sf-pill sf-pill-mode">
									<span>{fulfillmentLabel}</span>
								</span>
							</div>

							<h1 class="sf-hero-title">
								{heroSec.content?.title || config.store.name || 'Your Store'}
							</h1>
							{#if heroSec.content?.subtitle || config.store.tagline}
								<p class="sf-hero-subtitle">
									{heroSec.content?.subtitle || config.store.tagline}
								</p>
							{/if}
						</div>
					</section>
				{/if}

				<!-- Category Chip Strip -->
				{#if categoriesSec && categories.length > 1}
					<div class="sf-categories-bar" data-style={config.theme.filter_style}>
						<button
							type="button"
							class="sf-chip"
							class:active={activeCategory === ''}
							onclick={() => (activeCategory = '')}
						>
							All Items
						</button>
						{#each categories as category (category.id)}
							<button
								type="button"
								class="sf-chip"
								class:active={activeCategory === category.id}
								onclick={() => (activeCategory = category.id)}
							>
								{category.name}
							</button>
						{/each}
					</div>
				{/if}

				<!-- Product Catalog / Menu -->
				{#if menuSec}
					<div class="sf-menu-wrap">
						<div class="sf-menu-header-row">
							<h2 class="sf-menu-title">{menuSec.content?.title || 'Catalog & Menu'}</h2>
							<span class="sf-menu-count">{filteredProducts.length} items</span>
						</div>

						{#if filteredProducts.length === 0}
							<div class="sf-empty-state">
								<ShoppingBag size={28} strokeWidth={1.5} />
								<p>No products match your search or filter.</p>
							</div>
						{:else}
							<div
								class="sf-products"
								data-layout={config.theme.product_layout || 'list'}
								data-columns={config.theme.product_layout === 'grid' ? 'true' : undefined}
							>
								{#each filteredProducts as product (product.id)}
									<ProductCard
										{product}
										layout={config.theme.product_layout as any}
										currency={config.store.currency || 'INR'}
										inCart={cart[product.id] || 0}
										orderable={config.behaviour.ordering_enabled}
										businessType={bType}
										onadd={addToCart}
										onstep={stepCart}
									/>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				<!-- Business Info Section -->
				{#if businessSec && (config.store.address || config.store.phone)}
					<div class="sf-business-card">
						<h3 class="sf-business-title">Location & Contact</h3>
						<div class="sf-info-rows">
							{#if config.store.address}
								<div class="sf-info-row">
									<MapPin size={16} strokeWidth={2} />
									<span>{config.store.address}</span>
								</div>
							{/if}
							{#if config.store.phone}
								<div class="sf-info-row">
									<Clock size={16} strokeWidth={2} />
									<span>{config.store.phone}</span>
								</div>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Footer Section -->
				{#if footerSec}
					<footer class="sf-footer">
						<p>© {new Date().getFullYear()} {config.store.name}. Powered by Orderly.</p>
					</footer>
				{/if}

				<!-- Interactive Floating Sticky Cart Bar -->
				{#if cartItemCount > 0}
					<div class="sf-sticky-cart-bar">
						<div class="sf-sticky-cart-inner">
							<div class="sf-cart-summary">
								<span class="sf-cart-count-badge">{cartItemCount} item{cartItemCount === 1 ? '' : 's'}</span>
								<span class="sf-cart-total-price">₹{cartSubtotal}</span>
							</div>
							<button type="button" class="sf-checkout-button">
								<span>Checkout</span>
								<ArrowRight size={16} strokeWidth={2.4} />
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.studio-preview-pane {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--surface-2, #0b0f19);
		overflow: hidden;
	}

	.studio-preview-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 14px;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		gap: 12px;
		flex-wrap: wrap;
	}

	.studio-device-switcher {
		display: flex;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 6px);
		padding: 2px;
		gap: 2px;
	}

	.studio-device-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 5px 10px;
		font-size: 0.75rem;
		font-weight: 600;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: var(--text-2);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.studio-device-btn.active {
		background: var(--surface);
		color: var(--accent);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
	}

	.studio-catalog-select-wrap {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.studio-catalog-label {
		font-size: 0.71875rem;
		font-weight: 600;
		color: var(--text-3);
	}

	.studio-catalog-select {
		padding: 4px 8px;
		font-size: 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 6px);
		background: var(--surface);
		color: var(--text);
		cursor: pointer;
	}

	.studio-live-link {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--accent);
		text-decoration: none;
		padding: 5px 10px;
		border-radius: var(--radius-sm, 6px);
		background: color-mix(in srgb, var(--accent) 10%, transparent);
	}

	.studio-preview-stage {
		flex: 1;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		overflow-y: auto;
		padding: 1.5rem 1rem 3rem;
		background: repeating-linear-gradient(
			45deg,
			var(--surface-2),
			var(--surface-2) 10px,
			color-mix(in srgb, var(--surface-2) 94%, #000) 10px,
			color-mix(in srgb, var(--surface-2) 94%, #000) 20px
		);
	}

	.studio-device-shell {
		background: var(--surface);
		transition: width 0.25s cubic-bezier(0.16, 1, 0.3, 1);
		box-sizing: border-box;
	}

	.mobile-shell {
		max-width: 390px;
		min-height: 760px;
		border: 9px solid #1e293b;
		border-radius: 46px;
		box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05);
		overflow: hidden;
		position: relative;
	}

	.mobile-speaker-notch {
		display: flex;
		justify-content: center;
		padding: 8px 0 4px;
		background: #1e293b;
	}

	.mobile-speaker {
		width: 60px;
		height: 4px;
		background: #334155;
		border-radius: 999px;
	}

	.desktop-shell {
		width: 100%;
		max-width: 1020px;
		border: 1px solid var(--border);
		border-radius: var(--radius, 12px);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
		overflow: hidden;
	}

	.sf-preview-root {
		min-height: 600px;
		display: flex;
		flex-direction: column;
		background: var(--sf-bg, #ffffff);
		color: var(--sf-text, #0f172a);
		position: relative;
	}

	.sf-preview-search-input {
		display: flex;
		align-items: center;
		gap: 6px;
		background: var(--sf-surface-soft, rgba(0, 0, 0, 0.04));
		border: 1px solid var(--sf-border, rgba(0, 0, 0, 0.08));
		border-radius: 999px;
		padding: 4px 10px;
	}

	.sf-header-search-field {
		border: none;
		background: transparent;
		font-size: 0.75rem;
		color: var(--sf-text);
		width: 90px;
		outline: none;
	}

	.sf-bag-btn {
		position: relative;
	}

	.sf-bag-badge {
		position: absolute;
		top: -4px;
		right: -4px;
		background: var(--sf-primary, #5b4bdb);
		color: var(--sf-primary-ink, #ffffff);
		font-size: 0.65rem;
		font-weight: 700;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		display: grid;
		place-items: center;
	}

	.sf-hero-badge-row {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 8px;
	}

	.sf-verified-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		background: rgba(255, 255, 255, 0.2);
		backdrop-filter: blur(8px);
		padding: 3px 8px;
		border-radius: 999px;
		font-size: 0.6875rem;
		font-weight: 700;
		color: #ffffff;
	}

	.sf-pill {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 3px 8px;
		border-radius: 999px;
		font-size: 0.6875rem;
		font-weight: 600;
		background: rgba(255, 255, 255, 0.15);
		color: #ffffff;
	}

	.sf-categories-bar {
		display: flex;
		overflow-x: auto;
		gap: 8px;
		padding: 10px 14px;
		border-bottom: 1px solid var(--sf-border, rgba(0, 0, 0, 0.06));
		background: var(--sf-surface, #ffffff);
	}

	.sf-chip {
		padding: 5px 12px;
		font-size: 0.78125rem;
		font-weight: 600;
		border-radius: 999px;
		border: 1px solid var(--sf-border, rgba(0, 0, 0, 0.1));
		background: var(--sf-surface-soft, rgba(0, 0, 0, 0.04));
		color: var(--sf-text, #0f172a);
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.15s ease;
	}

	.sf-chip.active {
		background: var(--sf-primary, #5b4bdb);
		color: var(--sf-primary-ink, #ffffff);
		border-color: var(--sf-primary, #5b4bdb);
	}

	.sf-menu-wrap {
		padding: 14px;
		flex: 1;
	}

	.sf-menu-header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.sf-menu-title {
		font-size: 0.9375rem;
		font-weight: 700;
		margin: 0;
	}

	.sf-menu-count {
		font-size: 0.75rem;
		color: var(--sf-text-muted, #64748b);
	}

	.sf-business-card {
		margin: 10px 14px;
		padding: 12px;
		background: var(--sf-surface-soft, rgba(0, 0, 0, 0.02));
		border: 1px solid var(--sf-border, rgba(0, 0, 0, 0.08));
		border-radius: var(--sf-radius, 8px);
	}

	.sf-business-title {
		font-size: 0.8125rem;
		font-weight: 700;
		margin: 0 0 8px;
	}

	.sf-info-rows {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.sf-info-row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.75rem;
		color: var(--sf-text-muted, #64748b);
	}

	.sf-footer {
		padding: 16px 14px;
		text-align: center;
		font-size: 0.6875rem;
		color: var(--sf-text-muted, #94a3b8);
		border-top: 1px solid var(--sf-border, rgba(0, 0, 0, 0.06));
		margin-top: auto;
	}

	.sf-sticky-cart-bar {
		position: sticky;
		bottom: 12px;
		left: 0;
		right: 0;
		padding: 0 12px;
		z-index: 50;
	}

	.sf-sticky-cart-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 14px;
		background: var(--sf-primary, #5b4bdb);
		color: var(--sf-primary-ink, #ffffff);
		border-radius: var(--sf-radius-lg, 12px);
		box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.35);
	}

	.sf-cart-summary {
		display: flex;
		flex-direction: column;
	}

	.sf-cart-count-badge {
		font-size: 0.71875rem;
		opacity: 0.85;
	}

	.sf-cart-total-price {
		font-size: 0.9375rem;
		font-weight: 700;
	}

	.sf-checkout-button {
		display: flex;
		align-items: center;
		gap: 6px;
		background: #ffffff;
		color: #0f172a;
		border: none;
		border-radius: 999px;
		padding: 6px 14px;
		font-size: 0.8125rem;
		font-weight: 700;
		cursor: pointer;
	}

	.sf-empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 30px 14px;
		color: var(--sf-text-muted, #94a3b8);
		text-align: center;
		gap: 8px;
		font-size: 0.8125rem;
	}
</style>
