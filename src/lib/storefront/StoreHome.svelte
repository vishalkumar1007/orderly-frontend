<script lang="ts">
	import MapPin from '@tabler/icons-svelte/icons/map-pin';
	import Phone from '@tabler/icons-svelte/icons/phone';
	import type { StoreConfig, StoreMenu, StoreProduct } from '$lib/storefront/api';
	import { hoursRows } from '$lib/storefront/hours';
	import { formatPhone } from '$lib/storefront/format';
	import ProductCard from './ProductCard.svelte';
	import StoreIntro from './StoreIntro.svelte';
	import { quantityOf, type CartLine } from '$lib/storefront/cart.svelte';
	import { cardShape, experienceFor, type Experience } from '$lib/storefront/experience';

	/**
	 * The shop's front page. The owner's homepage sections render in the order
	 * they saved; the intro and the offer line sit on top because that is where
	 * a customer looks first. Nothing here is invented: no ratings, no empty
	 * categories, no rail that repeats the one above it.
	 */
	let {
		config,
		menu,
		lines = [],
		exp = undefined,
		onadd,
		onstep
	}: {
		config: StoreConfig;
		menu: StoreMenu;
		lines?: CartLine[];
		exp?: Experience;
		onadd?: (product: StoreProduct) => void;
		onstep?: (product: StoreProduct, delta: number) => void;
	} = $props();

	const store = $derived(config.store);
	const currency = $derived(store.currency ?? 'INR');
	const x = $derived(exp ?? experienceFor(config));
	const layout = $derived(cardShape(x, config.theme?.product_layout ?? 'list'));
	const visible = $derived((config.homepage?.sections ?? []).filter((s) => s.enabled));
	const orderable = $derived(config.ordering.enabled);
	const prepTime = $derived(config.ordering.prep_time_minutes ?? 0);

	const hero = $derived(visible.find((s) => s.type === 'HERO'));
	const announcement = $derived(visible.find((s) => s.type === 'ANNOUNCEMENT'));
	const liveBanner = $derived((config.ordering?.status_message ?? '').trim());
	const hours = $derived(config.hours);
	const hourRows = $derived(hoursRows(hours));

	const status = $derived(config.ordering?.store_status ?? (hours?.is_open ? 'OPEN' : 'CLOSED'));
	const statusTone = $derived(
		status === 'BUSY' ? 'busy' : status === 'OPEN' && hours?.is_open !== false ? 'open' : 'closed'
	);

	/** The facts a customer needs before they start choosing, as one sentence. */
	const facts = $derived.by(() => {
		const when = hours?.always_open ? 'Open now' : hours?.detail || (hours?.is_open ? 'Open now' : 'Closed');
		if (!orderable) return `${when}.`;
		if (status === 'BUSY') return `${when}. Busy right now, so orders take a little longer.`;
		if (!prepTime) return `${when}.`;
		return `${when}. Ready for ${x.words.fulfilment.toLowerCase()} in about ${prepTime} minutes.`;
	});

	const read = (section: { content: Record<string, string> } | undefined, key: string, fallback = '') =>
		section?.content?.[key]?.trim() || fallback;

	// The platform seeds every homepage with food titles. An owner who kept
	// them gets the words for their own trade; a title they wrote is kept.
	const SEEDED = new Set(['Popular right now', "Chef's picks"]);
	const titleFor = (section: { content: Record<string, string> }, fallback: string) => {
		const own = read(section, 'title');
		return own && !SEEDED.has(own) ? own : fallback;
	};

	let vegOnly = $state(false);
	let active = $state<string | null>(null);
	let nav = $state<HTMLElement>();

	const keep = (list: StoreProduct[]) => (vegOnly ? list.filter((p) => p.is_vegetarian) : list);

	const hasVeg = $derived(menu.products.some((p) => p.is_vegetarian));
	const hasNonVeg = $derived(menu.products.some((p) => p.is_vegetarian === false));
	const showVegToggle = $derived(x.features.dietMarks && hasVeg && hasNonVeg);

	const menuSection = $derived(visible.find((s) => s.type === 'MENU'));
	const categories = $derived.by(() => {
		const only = read(menuSection, 'category');
		return menu.categories
			.filter((c) => !only || c.id === only)
			.map((c) => ({ ...c, items: keep(c.products) }))
			.filter((c) => c.items.length > 0);
	});

	// One category needs no tabs; the veg switch alone still earns the strip.
	const showIndex = $derived(categories.length > 1 || showVegToggle);

	// Only dishes the owner actually flagged, and Chef's picks skip anything
	// Popular already showed, so the two rails never look like a copy.
	const popular = $derived(keep(menu.products.filter((p) => p.is_popular)).slice(0, 12));
	const featured = $derived.by(() => {
		const shown = visible.some((s) => s.type === 'POPULAR_PRODUCTS') ? new Set(popular.map((p) => p.id)) : new Set();
		return keep(menu.products.filter((p) => p.is_featured && !shown.has(p.id))).slice(0, 12);
	});

	function go(id: string) {
		active = id;
		document.getElementById('c-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	// Highlight the category the customer is reading, and keep its tab in view.
	$effect(() => {
		if (!categories.length) return;
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) if (e.isIntersecting) active = e.target.id.slice(2);
			},
			{ rootMargin: '-35% 0px -60% 0px' }
		);
		for (const c of categories) {
			const el = document.getElementById('c-' + c.id);
			if (el) io.observe(el);
		}
		return () => io.disconnect();
	});

	$effect(() => {
		const tab = active && nav?.querySelector<HTMLElement>(`[data-id="${active}"]`);
		if (!tab || !nav) return;
		const left = tab.offsetLeft - nav.clientWidth / 2 + tab.clientWidth / 2;
		nav.scrollTo({ left, behavior: 'smooth' });
	});

	const coverFor = (items: StoreProduct[]) => items.find((p) => p.image_url)?.image_url;
</script>

<div class="sh">
	{#if hero}
		<StoreIntro
			{config}
			title={read(hero, 'title', store.name)}
			subtitle={read(hero, 'subtitle', store.tagline || store.description)}
			{facts}
			tone={statusTone}
			notice={orderable ? '' : config.ordering.closed_reason || 'Online ordering is paused. You can still look at the menu.'}
		/>
	{/if}

	{#if !liveBanner && announcement && read(announcement, 'text')}
		<p class="sh-offer" data-tone={read(announcement, 'tone', 'info')}>{read(announcement, 'text')}</p>
	{/if}

	<div class="sh-body" class:sh-has-index={showIndex}>
		{#if showIndex}
			<nav class="sh-index" aria-label="Menu categories">
				{#if showVegToggle}
					<button class="sh-veg" type="button" aria-pressed={vegOnly} onclick={() => (vegOnly = !vegOnly)}>
						<span class="sh-veg-switch" aria-hidden="true"></span>
						Veg only
					</button>
				{/if}
				<div class="sh-tabs" bind:this={nav}>
					{#each categories as c (c.id)}
						<button
							type="button"
							data-id={c.id}
							aria-current={active === c.id ? 'true' : undefined}
							onclick={() => go(c.id)}
						>
							{c.name}
							<span class="sh-count">{c.items.length}</span>
						</button>
					{/each}
				</div>
			</nav>
		{/if}

		<div class="sh-content">
			{#each visible as section (section.id)}
				{#if section.type === 'CATEGORIES' && categories.length > 1}
					<section class="sh-section">
						<h2 class="sh-h2">{read(section, 'title', 'What are you craving?')}</h2>
						{#if read(section, 'subtitle')}<p class="sh-sub">{read(section, 'subtitle')}</p>{/if}
						<div class="sh-cats">
							{#each categories as c (c.id)}
								{@const cover = coverFor(c.items)}
								<button class="sh-cat" type="button" onclick={() => go(c.id)}>
									<span class="sh-cat-img">
										{#if cover}
											<img src={cover} alt="" loading="lazy" />
										{:else}
											{c.name.charAt(0)}
										{/if}
									</span>
									<span class="sh-cat-name">{c.name}</span>
								</button>
							{/each}
						</div>
					</section>
				{:else if section.type === 'POPULAR_PRODUCTS' || section.type === 'FEATURED_PRODUCTS'}
					{@const isPopular = section.type === 'POPULAR_PRODUCTS'}
					{@const items = isPopular ? popular : featured}
					{#if items.length}
						<section class="sh-section">
							<h2 class="sh-h2">
								{titleFor(section, isPopular ? x.words.popular : x.words.featured)}
							</h2>
							{#if read(section, 'subtitle') || read(section, 'description')}
								<p class="sh-sub">{read(section, 'subtitle') || read(section, 'description')}</p>
							{/if}
							<div class="sh-rail">
								{#each items as product (product.id)}
									<ProductCard
										{product}
										layout="compact"
										{currency}
										inCart={quantityOf(lines, product.id)}
										{orderable}
										exp={x}
										{onadd}
										{onstep}
									/>
								{/each}
							</div>
						</section>
					{/if}
				{:else if section.type === 'MENU'}
					{#if categories.length}
						<section class="sh-section sh-menu">
							<h2 class="sh-h2 sh-visually-hidden">{read(section, 'title', 'Menu')}</h2>
							{#each categories as c (c.id)}
								<section id={'c-' + c.id} class="sh-cat-block">
									<h3 class="sh-h3">{c.name}</h3>
									{#if c.description}<p class="sh-sub">{c.description}</p>{/if}
									<div class="sh-dishes" data-layout={layout} data-variant={x.variant}>
										{#each c.items as product (product.id)}
											<ProductCard
												{product}
												{layout}
												{currency}
												inCart={quantityOf(lines, product.id)}
												{orderable}
												exp={x}
												{onadd}
												{onstep}
											/>
										{/each}
									</div>
								</section>
							{/each}
						</section>
					{:else if vegOnly}
						<p class="sh-empty">
							No vegetarian dishes on the menu right now.
							<button type="button" onclick={() => (vegOnly = false)}>Show everything</button>
						</p>
					{/if}
				{:else if section.type === 'BUSINESS_INFO' && (store.address || store.phone)}
					<section class="sh-section">
						<h2 class="sh-h2">Find us</h2>
						<dl class="sh-info">
							{#if store.address}
								<div>
									<dt><MapPin size={18} stroke={1.6} aria-hidden="true" /> Address</dt>
									<dd>{store.address}</dd>
								</div>
							{/if}
							{#if store.phone}
								<div>
									<dt><Phone size={18} stroke={1.6} aria-hidden="true" /> Phone</dt>
									<dd><a href={'tel:' + store.phone.replace(/[^\d+]/g, '')}>{formatPhone(store.phone)}</a></dd>
								</div>
							{/if}
						</dl>
					</section>
				{:else if section.type === 'OPENING_HOURS' && !hours.always_open && hourRows.length}
					<section class="sh-section">
						<h2 class="sh-h2">Opening hours</h2>
						<dl class="sh-hours">
							{#each hourRows as row (row.key)}
								<div class:sh-today={row.isToday}>
									<dt>{row.label}{row.isToday ? ' (today)' : ''}</dt>
									<dd>{row.closed ? 'Closed' : row.ranges.join(', ')}</dd>
								</div>
							{/each}
						</dl>
					</section>
				{/if}
			{/each}
		</div>
	</div>
</div>

<style>
	.sh {
		--sh-maxw: 1088px;
		--sh-gutter: var(--sf-gutter, 16px);
		/* A wash of the shop's colour that reads in light and dark mode. */
		--sh-tint: color-mix(in srgb, var(--sf-primary) 14%, var(--sf-surface));
		width: 100%;
		max-width: var(--sh-maxw);
		margin: 0 auto;
		padding: 0 var(--sh-gutter) 32px;
		color: var(--sf-text);
	}

	.sh-offer {
		margin: 20px 0 0;
		padding: 12px 16px;
		border-radius: var(--sf-radius-sm);
		background: var(--sh-tint);
		color: var(--sf-text);
		font-size: 15px;
		font-weight: 500;
		border-left: 0;
	}
	.sh-offer[data-tone='warning'],
	.sh-offer[data-tone='warn'] {
		background: var(--sf-warn-soft);
		color: var(--sf-warn);
	}

	/* Category tabs: a sticky strip on phones, a sticky index on desktop. */
	.sh-index {
		position: sticky;
		top: var(--sf-header-h, 60px);
		z-index: 5;
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 24px calc(var(--sh-gutter) * -1) 0;
		padding: 0 var(--sh-gutter);
		background: var(--sf-bg, var(--sf-surface));
		border-bottom: 1px solid var(--sf-border);
	}
	.sh-tabs {
		display: flex;
		gap: 4px;
		overflow-x: auto;
		scrollbar-width: none;
		min-width: 0;
	}
	.sh-tabs::-webkit-scrollbar {
		display: none;
	}
	.sh-tabs button {
		position: relative;
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 48px;
		padding: 0 10px;
		border: 0;
		background: none;
		color: var(--sf-text-2);
		font: inherit;
		font-size: 15px;
		font-weight: 500;
		white-space: nowrap;
		cursor: pointer;
	}
	.sh-tabs button[aria-current='true'] {
		color: var(--sf-text);
		font-weight: 600;
	}
	.sh-tabs button[aria-current='true']::after {
		content: '';
		position: absolute;
		left: 10px;
		right: 10px;
		bottom: -1px;
		height: 3px;
		border-radius: 3px 3px 0 0;
		background: var(--sf-primary);
	}
	.sh-count {
		font-size: 12.5px;
		font-weight: 500;
		color: var(--sf-text-3);
		font-variant-numeric: tabular-nums;
	}

	.sh-veg {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 48px;
		padding: 0 12px 0 0;
		border: 0;
		border-right: 1px solid var(--sf-border);
		background: none;
		color: var(--sf-text);
		font: inherit;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
	}
	.sh-veg-switch {
		position: relative;
		width: 32px;
		height: 18px;
		border-radius: 999px;
		background: var(--sf-surface-3);
		transition: background 0.15s;
	}
	.sh-veg-switch::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
		transition: transform 0.15s;
	}
	.sh-veg[aria-pressed='true'] .sh-veg-switch {
		background: #0f8a3c;
	}
	.sh-veg[aria-pressed='true'] .sh-veg-switch::after {
		transform: translateX(14px);
	}

	.sh-tabs button:focus-visible,
	.sh-veg:focus-visible,
	.sh-cat:focus-visible {
		outline: 2px solid var(--sf-primary);
		outline-offset: -2px;
	}

	/* Sections. */
	.sh-section {
		padding-top: 36px;
	}
	.sh-h2 {
		margin: 0;
		font-family: var(--sf-font-display, var(--sf-font));
		font-size: 22px;
		font-weight: 700;
		letter-spacing: -0.015em;
	}
	.sh-h3 {
		margin: 0;
		font-family: var(--sf-font-display, var(--sf-font));
		font-size: 20px;
		font-weight: 700;
		letter-spacing: -0.01em;
	}
	.sh-sub {
		margin: 4px 0 0;
		font-size: 14.5px;
		color: var(--sf-text-2);
	}

	.sh-cats {
		display: flex;
		gap: 16px;
		margin: 16px calc(var(--sh-gutter) * -1) 0;
		padding: 0 var(--sh-gutter) 4px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.sh-cat {
		flex: none;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		width: 84px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--sf-text);
		font: inherit;
		cursor: pointer;
	}
	.sh-cat-img {
		display: grid;
		place-items: center;
		width: 76px;
		height: 76px;
		overflow: hidden;
		border-radius: 50%;
		background: var(--sh-tint);
		color: var(--sf-primary);
		font-family: var(--sf-font-display, var(--sf-font));
		font-size: 28px;
		font-weight: 700;
	}
	.sh-cat-img img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.sh-cat-name {
		font-size: 14px;
		font-weight: 500;
		text-align: center;
		line-height: 1.25;
	}

	.sh-rail {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 152px;
		gap: 14px;
		margin: 16px calc(var(--sh-gutter) * -1) 0;
		padding: 0 var(--sh-gutter) 6px;
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		scroll-padding-inline: var(--sh-gutter);
		scrollbar-width: none;
	}
	.sh-rail > :global(*) {
		scroll-snap-align: start;
	}

	.sh-menu {
		padding-top: 8px;
	}
	.sh-cat-block {
		padding-top: 28px;
		scroll-margin-top: calc(var(--sf-header-h, 60px) + 56px);
	}
	.sh-dishes[data-layout='list'] > :global(.pc),
	.sh-dishes[data-layout='compact'] > :global(.pc) {
		border-bottom: 1px solid var(--sf-border);
	}
	.sh-dishes > :global(.pc:last-child) {
		border-bottom: 0;
	}
	.sh-dishes[data-layout='grid'],
	.sh-dishes[data-layout='tile'] {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 24px 14px;
		padding-top: 16px;
	}
	.sh-dishes[data-layout='spec'] > :global(.pc) {
		border-bottom: 1px solid var(--sf-border);
	}

	.sh-empty {
		padding: 32px 0;
		color: var(--sf-text-2);
	}
	.sh-empty button {
		border: 0;
		background: none;
		color: var(--sf-primary);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.sh-info,
	.sh-hours {
		margin: 14px 0 0;
		max-width: 560px;
	}
	.sh-info > div,
	.sh-hours > div {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		padding: 12px 0;
		border-bottom: 1px solid var(--sf-border);
		font-size: 15px;
	}
	.sh-info dt {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		color: var(--sf-text-2);
		flex: none;
	}
	.sh-info dd,
	.sh-hours dd {
		margin: 0;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.sh-info a {
		color: var(--sf-primary);
		font-weight: 600;
		text-decoration: none;
	}
	.sh-hours dt {
		color: var(--sf-text-2);
	}
	.sh-today dt,
	.sh-today dd {
		color: var(--sf-text);
		font-weight: 600;
	}

	.sh-visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	@media (min-width: 720px) {
		.sh {
			--sh-gutter: 32px;
		}
		.sh-rail {
			grid-auto-columns: 180px;
		}
		.sh-dishes[data-layout='grid'],
		.sh-dishes[data-layout='tile'] {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	/* Desktop: categories become a sticky index beside the menu. */
	@media (min-width: 1024px) {
		.sh-body.sh-has-index {
			display: grid;
			grid-template-columns: 220px minmax(0, 1fr);
			gap: 48px;
			margin-top: 36px;
			padding-top: 4px;
			border-top: 1px solid var(--sf-border);
		}
		.sh-index {
			align-self: start;
			flex-direction: column;
			align-items: stretch;
			gap: 8px;
			margin: 0;
			padding: 28px 0 0;
			top: calc(var(--sf-header-h, 60px) + 8px);
			border: 0;
			background: none;
		}
		.sh-veg {
			border-right: 0;
			border-bottom: 1px solid var(--sf-border);
			padding: 0 0 4px;
			min-height: 44px;
		}
		.sh-tabs {
			flex-direction: column;
			gap: 2px;
			overflow: visible;
		}
		.sh-tabs button {
			justify-content: space-between;
			min-height: 40px;
			padding: 0 12px;
			border-radius: var(--sf-radius-sm);
		}
		.sh-tabs button:hover {
			background: var(--sf-surface-2);
		}
		.sh-tabs button[aria-current='true'] {
			background: var(--sh-tint);
			color: var(--sf-text);
		}
		.sh-tabs button[aria-current='true']::after {
			left: 0;
			right: auto;
			top: 10px;
			bottom: 10px;
			width: 3px;
			height: auto;
			border-radius: 0 3px 3px 0;
		}
		.sh-cat-block {
			scroll-margin-top: calc(var(--sf-header-h, 60px) + 16px);
		}
		.sh-dishes[data-layout='tile'] {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
		.sh-dishes[data-layout='tile'][data-variant='fashion'] {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		.sh-dishes[data-layout='list'] {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			column-gap: 40px;
		}
		/* In two columns every row keeps its rule, so the last pair lines up. */
		.sh-dishes[data-layout='list'] > :global(.pc:last-child) {
			border-bottom: 1px solid var(--sf-border);
		}
		.sh-cats,
		.sh-rail {
			margin-inline: 0;
			padding-inline: 0;
		}
		.sh-rail {
			grid-auto-columns: 200px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sh-veg-switch,
		.sh-veg-switch::after {
			transition: none;
		}
	}
</style>
