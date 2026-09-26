<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Phone from '@lucide/svelte/icons/phone';
	import Utensils from '@lucide/svelte/icons/utensils';
	import type { StoreConfig, StoreMenu, StoreProduct } from '$lib/storefront/api';
	import { hoursRows } from '$lib/storefront/hours';
	import { formatPhone, money } from '$lib/storefront/format';
	import ProductCard from './ProductCard.svelte';
	import { quantityOf, type CartLine } from '$lib/storefront/cart.svelte';

	/**
	 * The configuration-driven home page.
	 *
	 * The section list, its order, and which sections are on all come from the
	 * tenant's saved layout. This component only knows how to *render* the section
	 * types the platform supports — a type it does not recognise is skipped, so a
	 * layout saved by a newer build can never break an older one.
	 */
	let {
		config,
		menu,
		lines = [],
		onadd
	}: {
		config: StoreConfig;
		menu: StoreMenu;
		lines?: CartLine[];
		onadd?: (product: StoreProduct) => void;
	} = $props();

	const store = $derived(config.store);
	const currency = $derived(store.currency ?? 'INR');
	const sections = $derived(config.homepage?.sections ?? []);
	const visible = $derived(sections.filter((s) => s.enabled));
	const orderable = $derived(config.ordering.enabled);

	const hero = $derived(visible.find((s) => s.type === 'HERO'));
	const announcement = $derived(visible.find((s) => s.type === 'ANNOUNCEMENT'));
	const hours = $derived(config.hours);
	const hourRows = $derived(hoursRows(hours));
	const todayKey = $derived(hourRows.find((r) => r.isToday)?.key);

	/** `section` reads a content value with a fallback, so an empty field is safe. */
	const read = (section: { content: Record<string, string> } | undefined, key: string, fallback = '') =>
		section?.content?.[key]?.trim() || fallback;

	function productsFor(type: 'POPULAR_PRODUCTS' | 'FEATURED_PRODUCTS'): StoreProduct[] {
		if (type === 'POPULAR_PRODUCTS') {
			const popular = menu.products.filter((p) => p.is_popular);
			// An empty shelf is worse than a full one: fall back to the whole menu
			// so the section is never a dead end.
			return (popular.length ? popular : menu.products).slice(0, 10);
		}
		const featured = menu.products.filter((p) => p.is_featured);
		return (featured.length ? featured : menu.products).slice(0, 10);
	}

	/** The menu section can show the whole menu or one category. */
	const menuProducts = $derived.by(() => {
		const section = visible.find((s) => s.type === 'MENU');
		const categoryId = read(section, 'category');
		if (!categoryId) return menu.products;
		return menu.products.filter((p) => p.category_id === categoryId);
	});

	const menuCategories = $derived.by(() => {
		const section = visible.find((s) => s.type === 'MENU');
		const categoryId = read(section, 'category');
		if (!categoryId) return menu.categories;
		return menu.categories.filter((c) => c.id === categoryId);
	});

	const announceTone = $derived(read(announcement, 'tone', 'info'));
</script>

{#if announcement && read(announcement, 'text')}
	<div class="sf-announcement" data-tone={announceTone === 'info' ? undefined : announceTone}>
		{read(announcement, 'text')}
	</div>
{/if}

{#if hero}
	<section
		class="sf-hero"
		data-style={config.theme.hero}
		style={config.theme.hero === 'image' && store.logo_url
			? `background-image: linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.45)), url('${store.logo_url}')`
			: undefined}
	>
		<div class="sf-hero-inner">
			<h1>{read(hero, 'title', store.name)}</h1>
			{#if read(hero, 'subtitle', store.tagline || store.description)}
				<p>{read(hero, 'subtitle', store.tagline || store.description)}</p>
			{/if}
			{#if read(hero, 'cta_label')}
				<a class="sf-hero-cta" href={read(hero, 'cta_href', '/menu')}>{read(hero, 'cta_label')}</a>
			{:else if !orderable}
				<p style="margin-top:10px;font-weight:650;">Currently Closed</p>
			{/if}
		</div>
	</section>
{/if}

{#if !orderable}
	<div class="sf-wrap" style="padding-top:14px;">
		<div class="sf-alert" data-tone="warn" role="status">
			{config.ordering.closed_reason || 'Currently Closed'}
		</div>
	</div>
{/if}

{#each visible as section (section.id)}
	{#if section.type === 'CATEGORIES' && menu.categories.length}
		<div class="sf-section">
			<div class="sf-section-head">
				<h2>{read(section, 'title', 'Browse by category')}</h2>
				<a href="/menu">See menu</a>
			</div>
			<div class="sf-categories">
				{#each menu.categories as category (category.id)}
					<a class="sf-category" href={'/menu#' + category.id}>
						<span class="sf-category-icon" aria-hidden="true">
							<Utensils size={20} strokeWidth={1.9} />
						</span>
						<span class="sf-category-name">{category.name}</span>
						<span class="sf-category-count">
							{category.products.length} {category.products.length === 1 ? 'item' : 'items'}
						</span>
					</a>
				{/each}
			</div>
		</div>
	{:else if section.type === 'POPULAR_PRODUCTS' || section.type === 'FEATURED_PRODUCTS'}
		{@const products = productsFor(section.type as 'POPULAR_PRODUCTS' | 'FEATURED_PRODUCTS')}
		{#if products.length}
			<div class="sf-section">
				<div class="sf-section-head">
					<h2>
						{read(
							section,
							'title',
							section.type === 'POPULAR_PRODUCTS' ? 'Popular right now' : "Chef's picks"
						)}
					</h2>
					<a href="/menu">See all</a>
				</div>
				<div class="sf-rail">
					{#each products as product (product.id)}
						<ProductCard
							{product}
							{currency}
							inCart={quantityOf(lines, product.id)}
							{orderable}
							{onadd}
						/>
					{/each}
				</div>
			</div>
		{/if}
	{:else if section.type === 'MENU' && menuCategories.length}
		<div class="sf-section">
			<div class="sf-section-head">
				<h2>{read(section, 'title', 'Full menu')}</h2>
				<a href="/menu">Search</a>
			</div>
			<div class="sf-wrap" style="padding-inline:0;">
				{#each menuCategories as category (category.id)}
					<section id={category.id} style="scroll-margin-top:80px;">
						{#if menuCategories.length > 1}
							<h3
								style="margin:14px var(--sf-gutter) 8px;font-size:0.8125rem;font-weight:700;color:var(--sf-text-2);text-transform:uppercase;letter-spacing:0.04em;"
							>
								{category.name}
							</h3>
						{/if}
						<div class="sf-wrap" style="padding-inline:var(--sf-gutter);">
							<div class="sf-products" data-columns="true">
								{#each category.products as product (product.id)}
									<ProductCard
										{product}
										{currency}
										inCart={quantityOf(lines, product.id)}
										{orderable}
										{onadd}
									/>
								{/each}
							</div>
						</div>
					</section>
				{/each}
			</div>
		</div>
	{:else if section.type === 'BUSINESS_INFO' && (store.address || store.phone)}
		<div class="sf-section">
			<div class="sf-section-head"><h2>Where to find us</h2></div>
			<div class="sf-wrap">
				<div class="sf-panel">
					<div class="sf-info-list">
						{#if store.address}
							<div class="sf-info-row">
								<MapPin size={17} strokeWidth={1.9} aria-hidden="true" />
								<span>{store.address}</span>
							</div>
						{/if}
						{#if store.phone}
							<div class="sf-info-row">
								<Phone size={17} strokeWidth={1.9} aria-hidden="true" />
								<a href={'tel:' + store.phone.replace(/[^\d+]/g, '')}>{formatPhone(store.phone)}</a>
							</div>
						{/if}
						{#if !hours.always_open}
							<div class="sf-info-row">
								<CircleCheck size={17} strokeWidth={1.9} aria-hidden="true" />
								<span>{hours.is_open ? hours.detail : 'Currently Closed'}</span>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{:else if section.type === 'OPENING_HOURS' && !hours.always_open && hourRows.length}
		<div class="sf-section">
			<div class="sf-section-head"><h2>Opening hours</h2></div>
			<div class="sf-wrap">
				<div class="sf-panel">
					{#each hourRows as row (row.key)}
						<div class="sf-hours-row" data-today={String(row.isToday)}>
							<span>{row.label}</span>
							<span>{row.closed ? 'Closed' : row.ranges.join(', ')}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
{/each}
