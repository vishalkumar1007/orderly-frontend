<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Phone from '@lucide/svelte/icons/phone';
	import Utensils from '@lucide/svelte/icons/utensils';
	import Clock from '@lucide/svelte/icons/clock';
	import Star from '@lucide/svelte/icons/star';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Flame from '@lucide/svelte/icons/flame';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import type { StoreConfig, StoreMenu, StoreProduct } from '$lib/storefront/api';
	import { hoursRows } from '$lib/storefront/hours';
	import { formatPhone, money } from '$lib/storefront/format';
	import ProductCard from './ProductCard.svelte';
	import { quantityOf, type CartLine } from '$lib/storefront/cart.svelte';

	/**
	 * Professional Food Order App Storefront Home.
	 *
	 * Features an appetizing restaurant hero card with live status & prep time,
	 * sticky category navigation with instant Veg-Only dietary filter toggle,
	 * rich menu presentation, and strict sync with admin homepage/theme controls.
	 */
	let {
		config,
		menu,
		lines = [],
		onadd,
		onstep
	}: {
		config: StoreConfig;
		menu: StoreMenu;
		lines?: CartLine[];
		onadd?: (product: StoreProduct) => void;
		onstep?: (product: StoreProduct, delta: number) => void;
	} = $props();

	const store = $derived(config.store);
	const currency = $derived(store.currency ?? 'INR');
	const layout = $derived(config.theme?.product_layout ?? 'list');
	const sections = $derived(config.homepage?.sections ?? []);
	const visible = $derived(sections.filter((s) => s.enabled));
	const orderable = $derived(config.ordering.enabled);
	const prepTime = $derived(config.ordering.prep_time_minutes ?? 20);

	const bType = $derived(config.store.business_type || 'RESTAURANT');
	const isFoodType = $derived(
		bType === 'RESTAURANT' || bType === 'CAFE' || bType === 'BAKERY' || bType === 'JUICE_BAR'
	);
	const verifiedBadgeLabel = $derived(
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

	const hero = $derived(visible.find((s) => s.type === 'HERO'));
	const announcement = $derived(visible.find((s) => s.type === 'ANNOUNCEMENT'));
	const hours = $derived(config.hours);
	const hourRows = $derived(hoursRows(hours));
	const todayKey = $derived(hourRows.find((r) => r.isToday)?.key);

	// Client-side quick dietary filters on the home page
	let vegOnly = $state(false);
	let popularOnly = $state(false);
	let activeCategory = $state<string | null>(null);

	const storeStatus = $derived(
		config.ordering?.store_status ?? (hours?.is_open ? 'OPEN' : 'CLOSED')
	);
	const statusLabel = $derived(
		config.ordering?.store_status_label ?? (hours?.is_open ? 'Open Now' : 'Closed')
	);
	const statusDotClass = $derived.by(() => {
		switch (storeStatus) {
			case 'BUSY':
				return 'busy';
			case 'AWAY':
				return 'away';
			case 'CLOSED':
				return 'closed';
			default:
				return 'open';
		}
	});

	/** `section` reads a content value with a fallback, so an empty field is safe. */
	const read = (
		section: { content: Record<string, string> } | undefined,
		key: string,
		fallback = ''
	) => section?.content?.[key]?.trim() || fallback;

	function filterProducts(products: StoreProduct[]): StoreProduct[] {
		let list = products;
		if (vegOnly) {
			list = list.filter((p) => p.is_vegetarian);
		}
		if (popularOnly) {
			list = list.filter((p) => p.is_popular);
		}
		return list;
	}

	function productsFor(type: 'POPULAR_PRODUCTS' | 'FEATURED_PRODUCTS'): StoreProduct[] {
		if (type === 'POPULAR_PRODUCTS') {
			const popular = menu.products.filter((p) => p.is_popular);
			const base = popular.length ? popular : menu.products;
			return filterProducts(base).slice(0, 10);
		}
		const featured = menu.products.filter((p) => p.is_featured);
		const base = featured.length ? featured : menu.products;
		return filterProducts(base).slice(0, 10);
	}

	const menuCategories = $derived.by(() => {
		const section = visible.find((s) => s.type === 'MENU');
		const categoryId = read(section, 'category');
		let cats = menu.categories;
		if (categoryId) {
			cats = cats.filter((c) => c.id === categoryId);
		}
		// Apply quick filters to category's products
		return cats
			.map((c) => ({
				...c,
				filteredProducts: filterProducts(c.products)
			}))
			.filter((c) => c.filteredProducts.length > 0);
	});

	const announceTone = $derived(read(announcement, 'tone', 'info'));

	function scrollToCategory(id: string) {
		activeCategory = id;
		const el = document.getElementById(id);
		if (el) {
			el.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}
</script>

<!-- Announcement Banner -->
{#if announcement && read(announcement, 'text')}
	<div class="sf-announcement" data-tone={announceTone === 'info' ? undefined : announceTone}>
		<Sparkles size={16} strokeWidth={2.2} aria-hidden="true" />
		<span>{read(announcement, 'text')}</span>
	</div>
{/if}

<!-- Restaurant Profile & Hero Header -->
{#if hero}
	<section class="sf-restaurant-hero">
		<!-- Panoramic Cover Banner -->
		<div
			class="sf-hero-cover"
			style={config.theme.hero_image_url
				? `background-image: linear-gradient(180deg, rgba(15, 23, 42, 0.25) 0%, rgba(15, 23, 42, 0.75) 100%), url('${config.theme.hero_image_url}')`
				: undefined}
		>
			<div class="sf-hero-cover-pattern" aria-hidden="true"></div>
		</div>

		<!-- Overlapping Restaurant Profile Card -->
		<div class="sf-restaurant-card-wrap">
			<div class="sf-restaurant-card">
				<div class="sf-restaurant-top">
					<div class="sf-restaurant-logo-box">
						{#if store.logo_url}
							<img
								class="sf-restaurant-logo"
								src={store.logo_url}
								alt={store.name}
								width="80"
								height="80"
							/>
						{:else}
							<div class="sf-restaurant-logo-placeholder" aria-hidden="true">
								{(store.name || 'S').charAt(0).toUpperCase()}
							</div>
						{/if}
					</div>

					<div class="sf-restaurant-headline">
						<div class="sf-restaurant-title-row">
							<h1 class="sf-restaurant-title">{read(hero, 'title', store.name)}</h1>
							<span class="sf-verified-badge" title={verifiedBadgeLabel}>
								<ShieldCheck size={18} strokeWidth={2.4} aria-hidden="true" />
							</span>
						</div>

						{#if read(hero, 'subtitle', store.tagline || store.description)}
							<p class="sf-restaurant-tagline">
								{read(hero, 'subtitle', store.tagline || store.description)}
							</p>
						{/if}
					</div>
				</div>

				<!-- Key Operational Badges Row -->
				<div class="sf-restaurant-pills">
					<!-- Rating Badge -->
					<div class="sf-pill sf-pill-rating">
						<Star size={14} strokeWidth={2.6} class="sf-star-icon" aria-hidden="true" />
						<span class="sf-pill-bold">4.8</span>
						<span class="sf-pill-sub">(200+)</span>
					</div>

					<!-- Live Status Pill -->
					<div class="sf-pill sf-pill-status">
						<span class="sf-status-dot sf-status-{statusDotClass}" aria-hidden="true"></span>
						<span class="sf-pill-text">{statusLabel}</span>
					</div>

					<!-- Prep Time Badge -->
					{#if prepTime}
						<div class="sf-pill sf-pill-prep">
							<Clock size={14} strokeWidth={2.2} aria-hidden="true" />
							<span class="sf-pill-text">~{prepTime} mins</span>
						</div>
					{/if}

					<!-- Fulfillment Pill -->
					<div class="sf-pill sf-pill-mode">
						<span class="sf-pill-text">{fulfillmentLabel}</span>
					</div>

					<!-- Address Pill -->
					{#if store.address}
						<div class="sf-pill sf-pill-location sf-desktop-only" title={store.address}>
							<MapPin size={13} strokeWidth={2.2} aria-hidden="true" />
							<span class="sf-pill-text sf-truncate-text">{store.address}</span>
						</div>
					{/if}
				</div>

				{#if !orderable}
					<div class="sf-restaurant-closed-alert" role="status">
						<span class="sf-alert-badge">Notice</span>
						<span>{config.ordering.closed_reason || 'Currently Closed for Online Orders'}</span>
					</div>
				{/if}
			</div>
		</div>
	</section>
{/if}

<!-- Sticky Category & Quick Filter Bar -->
<div class="sf-sticky-nav-bar">
	<div class="sf-sticky-nav-inner">
		<!-- Quick Dietary Switches (Shown for Food businesses) -->
		<div class="sf-diet-filters">
			{#if isFoodType}
				<button
					class="sf-diet-toggle {vegOnly ? 'sf-active-veg' : ''}"
					type="button"
					onclick={() => (vegOnly = !vegOnly)}
					aria-pressed={vegOnly}
					title="Show vegetarian dishes only"
				>
					<span class="sf-diet-mark sf-diet-veg" aria-hidden="true">
						<span class="sf-diet-circle"></span>
					</span>
					<span class="sf-diet-toggle-label">Veg Only</span>
				</button>
			{/if}

			<button
				class="sf-diet-toggle {popularOnly ? 'sf-active-popular' : ''}"
				type="button"
				onclick={() => (popularOnly = !popularOnly)}
				aria-pressed={popularOnly}
				title="Show popular bestsellers"
			>
				<Flame size={14} strokeWidth={2.5} class="sf-flame-icon" aria-hidden="true" />
				<span class="sf-diet-toggle-label">Bestsellers</span>
			</button>
		</div>

		<div class="sf-sticky-nav-divider" aria-hidden="true"></div>

		<!-- Scrollable Category Chips -->
		<div class="sf-nav-categories">
			{#each menu.categories as category (category.id)}
				<button
					class="sf-nav-chip {activeCategory === category.id ? 'sf-active-chip' : ''}"
					type="button"
					onclick={() => scrollToCategory(category.id)}
				>
					<span class="sf-nav-chip-name">{category.name}</span>
					<span class="sf-nav-chip-count">{category.products.length}</span>
				</button>
			{/each}
		</div>
	</div>
</div>

<!-- Homepage Sections rendered in exact order -->
<div class="sf-sections-container">
	{#each visible as section (section.id)}
		{#if section.type === 'CATEGORIES' && menu.categories.length}
			<div class="sf-section sf-categories-section">
				<div class="sf-section-head">
					<div class="sf-section-title-wrap">
						<h2 class="sf-section-title">{read(section, 'title', 'Browse by category')}</h2>
						<span class="sf-section-sub">Handcrafted fresh daily</span>
					</div>
					<a href="/menu" class="sf-section-link">
						<span>See full menu</span>
						<ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
					</a>
				</div>
				<div class="sf-categories-grid">
					{#each menu.categories as category (category.id)}
						<button
							class="sf-category-card"
							type="button"
							onclick={() => scrollToCategory(category.id)}
						>
							<div class="sf-category-icon-box" aria-hidden="true">
								<Utensils size={22} strokeWidth={2} />
							</div>
							<div class="sf-category-info">
								<span class="sf-category-title">{category.name}</span>
								<span class="sf-category-subtitle">
									{category.products.length} {category.products.length === 1 ? 'item' : 'items'}
								</span>
							</div>
						</button>
					{/each}
				</div>
			</div>
		{:else if section.type === 'POPULAR_PRODUCTS' || section.type === 'FEATURED_PRODUCTS'}
			{@const products = productsFor(section.type as 'POPULAR_PRODUCTS' | 'FEATURED_PRODUCTS')}
			{#if products.length}
				<div class="sf-section sf-rail-section">
					<div class="sf-section-head">
						<div class="sf-section-title-wrap">
							<div class="sf-section-badge-title">
								{#if section.type === 'POPULAR_PRODUCTS'}
									<Flame size={18} strokeWidth={2.5} class="sf-icon-flame" aria-hidden="true" />
								{:else}
									<Sparkles size={18} strokeWidth={2.4} class="sf-icon-sparkle" aria-hidden="true" />
								{/if}
								<h2 class="sf-section-title">
									{read(
										section,
										'title',
										section.type === 'POPULAR_PRODUCTS' ? 'Popular right now' : "Chef's picks"
									)}
								</h2>
							</div>
							<span class="sf-section-sub">Customer favorites loved by everyone</span>
						</div>
						<a href="/menu" class="sf-section-link">
							<span>See all</span>
							<ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
						</a>
					</div>
					<div class="sf-rail">
						{#each products as product (product.id)}
							<ProductCard
								{product}
								layout="compact"
								{currency}
								inCart={quantityOf(lines, product.id)}
								{orderable}
								businessType={bType}
								{onadd}
								{onstep}
							/>
						{/each}
					</div>
				</div>
			{/if}
		{:else if section.type === 'MENU' && menuCategories.length}
			<div class="sf-section sf-menu-section-wrap">
				<div class="sf-section-head">
					<div class="sf-section-title-wrap">
						<h2 class="sf-section-title">{read(section, 'title', 'Full Menu')}</h2>
						<span class="sf-section-sub">
							{#if vegOnly}
								Showing vegetarian dishes only
							{:else}
								All freshly prepared items
							{/if}
						</span>
					</div>
					<a href="/menu" class="sf-section-link">
						<span>Filter & Search</span>
						<ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
					</a>
				</div>

				<div class="sf-menu-categories-list">
					{#each menuCategories as category (category.id)}
						<section id={category.id} class="sf-category-block">
							<div class="sf-category-header">
								<div class="sf-category-header-main">
									<h3 class="sf-category-heading">{category.name}</h3>
									<span class="sf-category-badge">
										{category.filteredProducts.length} {category.filteredProducts.length === 1 ? 'item' : 'items'}
									</span>
								</div>
								{#if category.description}
									<p class="sf-category-desc">{category.description}</p>
								{/if}
							</div>

							<div class="sf-products" data-layout={layout}>
								{#each category.filteredProducts as product (product.id)}
									<ProductCard
										{product}
										{layout}
										{currency}
										inCart={quantityOf(lines, product.id)}
										{orderable}
										businessType={bType}
										{onadd}
										{onstep}
									/>
								{/each}
							</div>
						</section>
					{/each}
				</div>
			</div>
		{:else if section.type === 'BUSINESS_INFO' && (store.address || store.phone)}
			<div class="sf-section sf-business-section">
				<div class="sf-section-head">
					<h2 class="sf-section-title">Where to find us</h2>
				</div>
				<div class="sf-business-card">
					<div class="sf-business-info-grid">
						{#if store.address}
							<div class="sf-business-item">
								<div class="sf-business-icon" aria-hidden="true">
									<MapPin size={20} strokeWidth={2} />
								</div>
								<div class="sf-business-details">
									<span class="sf-business-label">Address</span>
									<span class="sf-business-value">{store.address}</span>
								</div>
							</div>
						{/if}
						{#if store.phone}
							<div class="sf-business-item">
								<div class="sf-business-icon" aria-hidden="true">
									<Phone size={20} strokeWidth={2} />
								</div>
								<div class="sf-business-details">
									<span class="sf-business-label">Phone</span>
									<a
										class="sf-business-link"
										href={'tel:' + store.phone.replace(/[^\d+]/g, '')}
									>
										{formatPhone(store.phone)}
									</a>
								</div>
							</div>
						{/if}
						<div class="sf-business-item">
							<div class="sf-business-icon" aria-hidden="true">
								<CircleCheck size={20} strokeWidth={2} />
							</div>
							<div class="sf-business-details">
								<span class="sf-business-label">Current Status</span>
								<span class="sf-business-value">
									{hours.is_open ? hours.detail : 'Currently Closed'}
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		{:else if section.type === 'OPENING_HOURS' && !hours.always_open && hourRows.length}
			<div class="sf-section sf-hours-section">
				<div class="sf-section-head">
					<h2 class="sf-section-title">Opening Hours</h2>
				</div>
				<div class="sf-hours-card">
					<div class="sf-hours-table">
						{#each hourRows as row (row.key)}
							<div class="sf-hours-row {row.isToday ? 'sf-today-row' : ''}">
								<div class="sf-hours-day">
									<span>{row.label}</span>
									{#if row.isToday}
										<span class="sf-today-badge">Today</span>
									{/if}
								</div>
								<span class="sf-hours-time {row.closed ? 'sf-closed-time' : ''}">
									{row.closed ? 'Closed' : row.ranges.join(', ')}
								</span>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	{/each}
</div>
