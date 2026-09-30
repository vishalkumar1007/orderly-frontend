<script lang="ts">
	import { onMount, tick } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import Receipt from '@lucide/svelte/icons/receipt';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import User from '@lucide/svelte/icons/user';
	import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
	import '$lib/storefront/storefront-app.css';
	import {
		adminToStoreConfig,
		storefrontAdminApi,
		type AdminStorefront
	} from '$lib/storefront/admin';
	import type { StoreCategory, StoreMenu, StoreProduct } from '$lib/storefront/api';
	import { createCart, provideCart } from '$lib/storefront/cart-state.svelte';
	import { estimateTotals, lineKey, lineTotal } from '$lib/storefront/cart.svelte';
	import { money } from '$lib/storefront/format';
	import ProductCard from '$lib/storefront/ProductCard.svelte';
	import StoreCartBar from '$lib/storefront/StoreCartBar.svelte';
	import StoreFooter from '$lib/storefront/StoreFooter.svelte';
	import StoreHeader from '$lib/storefront/StoreHeader.svelte';
	import StoreHome from '$lib/storefront/StoreHome.svelte';
	import StoreRoot from '$lib/storefront/StoreRoot.svelte';
	import StoreTabBar from '$lib/storefront/StoreTabBar.svelte';
	import StoreToast from '$lib/storefront/StoreToast.svelte';
	import { fontImportFor, hasCompleteTokens, FALLBACK_THEME } from '$lib/storefront/theme';

	/**
	 * Interactive Studio preview.
	 *
	 * Same-origin frame that receives the working draft via postMessage, then
	 * lets staff tap through home / menu / product / cart like a real phone.
	 * Checkout and account APIs stay disabled here — Publish is still required
	 * for customers.
	 */
	const MSG_READY = 'orderly-studio-preview-ready';
	const MSG_DRAFT = 'orderly-studio-draft';
	const CART_SLUG = 'studio-preview';

	type View = 'home' | 'menu' | 'cart' | 'product' | 'orders' | 'login';

	let draft = $state<AdminStorefront | null>(null);
	let menu = $state<StoreMenu | null>(null);
	let menuError = $state('');
	let loadingMenu = $state(true);
	let view = $state<View>('home');
	let productId = $state<string | null>(null);
	let menuCategoryId = $state('all');
	let searchTerm = $state('');
	let shellEl = $state<HTMLElement | null>(null);
	let checkoutHint = $state(false);

	const cart = provideCart(createCart(CART_SLUG, []));

	const config = $derived(draft ? adminToStoreConfig(draft) : null);
	const theme = $derived(hasCompleteTokens(config?.theme) ? config!.theme : FALLBACK_THEME);
	const fontImport = $derived(fontImportFor(theme.font));
	const loginEnabled = $derived(
		(config?.ordering?.customer_login_mode ??
			(config?.ordering?.customer_login ? 'optional' : 'off')) !== 'off'
	);
	const footerShowsHours = $derived(
		!config?.homepage?.sections?.some((s) => s.enabled && s.type === 'OPENING_HOURS')
	);
	const layout = $derived(config?.theme?.product_layout ?? 'list');
	const currency = $derived(config?.store?.currency ?? 'INR');
	const orderable = $derived(config?.ordering?.enabled ?? false);
	const showsCartBar = $derived(
		Boolean(config) && cart.count > 0 && view !== 'cart' && view !== 'login'
	);
	const showSearch = $derived(view === 'home' || view === 'menu');
	const query = $derived(searchTerm.trim());

	const activePath = $derived.by(() => {
		switch (view) {
			case 'menu':
				return '/menu';
			case 'cart':
				return '/cart';
			case 'product':
				return '/menu';
			case 'orders':
				return '/orders';
			case 'login':
				return '/login';
			default:
				return '/';
		}
	});

	const product = $derived(
		productId && menu ? (menu.products.find((p) => p.id === productId) ?? null) : null
	);

	function matchesQuery(product: StoreProduct, needle: string) {
		return (
			product.name.toLowerCase().includes(needle) ||
			(product.description ?? '').toLowerCase().includes(needle)
		);
	}

	const searchMatches = $derived.by(() => {
		if (!menu || !query) return null;
		const needle = query.toLowerCase();
		return menu.products.filter((product) => matchesQuery(product, needle));
	});

	const menuProducts = $derived.by(() => {
		if (!menu) return [] as StoreProduct[];
		let list =
			menuCategoryId === 'all'
				? menu.products
				: menu.products.filter((p) => p.category_id === menuCategoryId);
		if (!query) return list;
		const needle = query.toLowerCase();
		return list.filter((product) => matchesQuery(product, needle));
	});

	const cartTotals = $derived(estimateTotals(cart.lines));

	function isStudioMessage(data: unknown): data is { type: string; draft?: AdminStorefront } {
		return Boolean(data && typeof data === 'object' && 'type' in data);
	}

	function applyDraft(next: AdminStorefront) {
		draft = next;
		if (menu) {
			menu = {
				...menu,
				store: {
					name: next.store.name,
					slug: next.store.slug
				},
				ordering: {
					enabled: next.behaviour.ordering_enabled && next.ordering_available_now,
					closed_reason: next.closed_reason || next.behaviour.closed_message || ''
				}
			};
		}
	}

	async function go(next: View, id: string | null = null) {
		view = next;
		productId = id;
		checkoutHint = false;
		await tick();
		shellEl?.scrollTo(0, 0);
	}

	function navigate(href: string) {
		let path = href;
		try {
			path = new URL(href, 'https://preview.local').pathname;
		} catch {
			/* keep raw */
		}
		if (path === '/' || path === '') {
			void go('home');
			return;
		}
		if (path.startsWith('/menu')) {
			menuCategoryId = 'all';
			void go('menu');
			return;
		}
		if (path.startsWith('/cart') || path.startsWith('/checkout') || path.startsWith('/payment')) {
			if (path.startsWith('/checkout') || path.startsWith('/payment')) {
				void go('cart');
				checkoutHint = true;
				cart.setNotice('Checkout is preview-only — publish to take real orders');
				return;
			}
			void go('cart');
			return;
		}
		if (path.startsWith('/product/')) {
			const id = decodeURIComponent(path.slice('/product/'.length).split('/')[0] ?? '');
			void go('product', id || null);
			return;
		}
		if (path.startsWith('/orders') || path.startsWith('/order/')) {
			void go('orders');
			return;
		}
		if (path.startsWith('/login') || path.startsWith('/profile') || path.startsWith('/verify-otp')) {
			void go('login');
			return;
		}
	}

	function add(product: StoreProduct) {
		cart.add(product, 1);
	}

	function step(product: StoreProduct, delta: number) {
		cart.step(lineKey(product.id, []), delta);
	}

	function addProductPage() {
		if (!product) return;
		cart.add(product, 1);
		void go('cart');
	}

	$effect(() => {
		if (!cart.notice) return;
		const t = setTimeout(() => cart.setNotice(''), 2600);
		return () => clearTimeout(t);
	});

	onMount(() => {
		const origin = window.location.origin;

		function onMessage(event: MessageEvent) {
			if (event.origin !== origin) return;
			if (!isStudioMessage(event.data) || event.data.type !== MSG_DRAFT) return;
			if (event.data.draft) applyDraft(event.data.draft);
		}

		window.addEventListener('message', onMessage);

		function trapNav(event: MouseEvent) {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const anchor = target.closest('a');
			if (!anchor) return;
			const href = anchor.getAttribute('href');
			if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) {
				return;
			}
			if (href.startsWith('#')) return;
			event.preventDefault();
			event.stopPropagation();
			navigate(href);
		}
		document.addEventListener('click', trapNav, true);

		void (async () => {
			try {
				const raw = await storefrontAdminApi.preview();
				const categories = (raw.categories ?? []) as StoreCategory[];
				const products = (raw.products ?? []) as StoreProduct[];
				menu = {
					store: {
						name: draft?.store.name ?? 'Store',
						slug: draft?.store.slug ?? ''
					},
					categories,
					products,
					ordering: { enabled: true, closed_reason: '' }
				};
				menuError = '';
			} catch (err) {
				menu = {
					store: { name: 'Store', slug: '' },
					categories: [],
					products: [],
					ordering: { enabled: true, closed_reason: '' }
				};
				menuError = err instanceof Error ? err.message : 'Could not load menu';
			} finally {
				loadingMenu = false;
				window.parent.postMessage({ type: MSG_READY }, origin);
			}
		})();

		return () => {
			window.removeEventListener('message', onMessage);
			document.removeEventListener('click', trapNav, true);
		};
	});
</script>

<svelte:head>
	{#if fontImport}
		<link rel="stylesheet" href={fontImport} />
	{/if}
	<meta name="robots" content="noindex" />
</svelte:head>

{#if !config || loadingMenu}
	<div class="preview-boot">Loading preview…</div>
{:else}
	<StoreRoot {config} tenantSlug={config.store.slug}>
		<div class="sf-shell studio-preview-shell" bind:this={shellEl}>
			<StoreHeader
				{config}
				lines={cart.lines}
				search={showSearch}
				bind:searchTerm
				signedIn={false}
				{loginEnabled}
				previewMode={true}
				{activePath}
			/>
			<main class="sf-main" data-has-cart={showsCartBar}>
				{#if menuError && view === 'home'}
					<div class="sf-wrap" style="padding-top:12px;">
						<div class="sf-alert" data-tone="warn" role="status">{menuError}</div>
					</div>
				{/if}

				{#if view === 'home' && menu && query && searchMatches}
					<div class="sf-wrap" style="padding-top:18px;">
						<div class="sf-section-head" style="padding-inline:0;margin-bottom:10px;">
							<h2>{searchMatches.length} result{searchMatches.length === 1 ? '' : 's'} for “{query}”</h2>
							<button
								type="button"
								style="border:none;background:transparent;color:var(--sf-primary);font:inherit;font-weight:600;cursor:pointer;padding:0;"
								onclick={() => (searchTerm = '')}
							>
								Clear
							</button>
						</div>
						{#if searchMatches.length === 0}
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
								{#each searchMatches as item (item.id)}
									<ProductCard
										product={item}
										{layout}
										{currency}
										inCart={cart.quantityOf(item.id)}
										{orderable}
										businessType={config.store.business_type}
										onadd={add}
										onstep={step}
									/>
								{/each}
							</div>
						{/if}
					</div>
				{:else if view === 'home' && menu}
					<StoreHome {config} {menu} lines={cart.lines} onadd={add} onstep={step} />
				{:else if view === 'menu' && menu}
					<div class="sf-wrap" style="padding-top:14px;">
						<div class="sf-section-head" style="padding-inline:0;margin-bottom:10px;">
							<h2>Menu</h2>
						</div>
						{#if menu.categories.length}
							<div class="preview-cats" role="tablist" aria-label="Categories">
								<button
									type="button"
									class="preview-cat"
									class:active={menuCategoryId === 'all'}
									onclick={() => (menuCategoryId = 'all')}
								>
									All
								</button>
								{#each menu.categories as cat (cat.id)}
									<button
										type="button"
										class="preview-cat"
										class:active={menuCategoryId === cat.id}
										onclick={() => (menuCategoryId = cat.id)}
									>
										{cat.name}
									</button>
								{/each}
							</div>
						{/if}
						{#if menuProducts.length === 0}
							<div class="sf-empty">
								<span class="sf-empty-icon" aria-hidden="true">
									<UtensilsCrossed size={26} strokeWidth={1.7} />
								</span>
								<h3>No items here</h3>
								<p>Try another category, or add products in Menu.</p>
							</div>
						{:else}
							<div class="sf-products" data-layout={layout}>
								{#each menuProducts as item (item.id)}
									<ProductCard
										product={item}
										{layout}
										{currency}
										inCart={cart.quantityOf(item.id)}
										{orderable}
										businessType={config.store.business_type}
										onadd={add}
										onstep={step}
									/>
								{/each}
							</div>
						{/if}
					</div>
				{:else if view === 'product'}
					<div class="sf-wrap" style="padding-top:8px;">
						<button type="button" class="preview-back" onclick={() => go('menu')}>
							<ArrowLeft size={16} strokeWidth={2.2} />
							Menu
						</button>
						{#if product}
							{#if product.image_url}
								<div class="sf-detail-media">
									<img
										src={product.image_url}
										alt={product.name}
										width="800"
										height="500"
										decoding="async"
									/>
								</div>
							{/if}
							<div class="sf-detail-body">
								<h1 class="sf-detail-title">{product.name}</h1>
								<p class="sf-detail-price">{money(product.price, currency)}</p>
								{#if product.description}
									<p class="sf-detail-desc">{product.description}</p>
								{/if}
								{#if !product.is_available}
									<div class="sf-alert" data-tone="error" role="status">Sold out right now.</div>
								{:else if !orderable}
									<div class="sf-alert" data-tone="warn" role="status">
										{config.ordering.closed_reason || 'Currently closed'}
									</div>
								{:else}
									<button
										type="button"
										class="sf-btn sf-btn-primary"
										style="width:100%;margin-top:16px;"
										onclick={addProductPage}
									>
										Add to cart · {money(product.price, currency)}
									</button>
								{/if}
							</div>
						{:else}
							<div class="sf-empty">
								<h3>Item not found</h3>
								<p>This product is not in the current menu.</p>
								<a class="sf-btn sf-btn-secondary" href="/menu">Back to menu</a>
							</div>
						{/if}
					</div>
				{:else if view === 'cart'}
					<div class="sf-wrap" style="padding-top:16px;">
						<div class="sf-section-head" style="padding-inline:0;margin-bottom:6px;">
							<h2>Your cart</h2>
							{#if cart.lines.length > 0}
								<button type="button" class="sf-line-remove" style="padding:0;" onclick={() => cart.empty()}>
									Clear cart
								</button>
							{/if}
						</div>
						{#if checkoutHint}
							<div class="sf-alert" data-tone="info" role="status" style="margin-bottom:12px;">
								Checkout is disabled in Studio preview. Publish to take real orders.
							</div>
						{/if}
						{#if cart.lines.length === 0}
							<div class="sf-empty">
								<span class="sf-empty-icon" aria-hidden="true">
									<ShoppingBag size={26} strokeWidth={1.7} />
								</span>
								<h3>Your cart is empty</h3>
								<p>Add something from the menu and it will show up here.</p>
								<a class="sf-btn sf-btn-primary" href="/menu">Browse the menu</a>
							</div>
						{:else}
							<div class="sf-panel">
								{#each cart.lines as line (line.key)}
									<div class="sf-line">
										<div class="sf-line-media">
											{#if line.image_url}
												<img
													src={line.image_url}
													alt=""
													width="60"
													height="60"
													loading="lazy"
													decoding="async"
												/>
											{/if}
										</div>
										<div class="sf-line-body">
											<div class="sf-line-head">
												<span class="sf-line-name">{line.name}</span>
												<span class="sf-line-price">{money(lineTotal(line), currency)}</span>
											</div>
											<div class="sf-line-foot">
												<div class="sf-stepper">
													<button
														type="button"
														aria-label={'One fewer ' + line.name}
														onclick={() => cart.step(line.key, -1)}
													>
														<Minus size={15} strokeWidth={2.4} aria-hidden="true" />
													</button>
													<output aria-live="polite">{line.quantity}</output>
													<button
														type="button"
														aria-label={'One more ' + line.name}
														disabled={line.quantity >= 20}
														onclick={() => cart.step(line.key, 1)}
													>
														<Plus size={15} strokeWidth={2.4} aria-hidden="true" />
													</button>
												</div>
												<button
													class="sf-line-remove"
													type="button"
													onclick={() => cart.remove(line.key)}
												>
													<Trash2 size={15} strokeWidth={1.9} aria-hidden="true" /> Remove
												</button>
											</div>
										</div>
									</div>
								{/each}
							</div>
							<div class="sf-panel" style="margin-top:12px;">
								<div class="sf-totals">
									<div class="sf-total-row">
										<span>Subtotal</span>
										<span>{money(cartTotals.subtotal, currency)}</span>
									</div>
									<div class="sf-total-row sf-total-grand">
										<span>Total (est.)</span>
										<span>{money(cartTotals.total, currency)}</span>
									</div>
								</div>
							</div>
							<button
								type="button"
								class="sf-btn sf-btn-primary"
								style="width:100%;margin-top:14px;"
								onclick={() => {
									checkoutHint = true;
									cart.setNotice('Checkout is preview-only — publish to take real orders');
								}}
							>
								Checkout (preview)
							</button>
						{/if}
					</div>
				{:else if view === 'orders'}
					<div class="sf-wrap" style="padding-top:28px;">
						<div class="sf-empty">
							<span class="sf-empty-icon" aria-hidden="true">
								<Receipt size={26} strokeWidth={1.7} />
							</span>
							<h3>Orders</h3>
							<p>Order history uses the live store after publish. Browse and cart work here in preview.</p>
							<a class="sf-btn sf-btn-secondary" href="/">Back home</a>
						</div>
					</div>
				{:else if view === 'login'}
					<div class="sf-wrap" style="padding-top:28px;">
						<div class="sf-empty">
							<span class="sf-empty-icon" aria-hidden="true">
								<User size={26} strokeWidth={1.7} />
							</span>
							<h3>Sign in</h3>
							<p>Customer login is available on the published storefront. Preview focuses on browse &amp; cart.</p>
							<a class="sf-btn sf-btn-secondary" href="/">Back home</a>
						</div>
					</div>
				{/if}
			</main>
			<StoreFooter {config} showHours={!footerShowsHours} />
			<StoreCartBar
				lines={cart.lines}
				{config}
				totals={cartTotals}
				visible={showsCartBar}
			/>
			<StoreTabBar {loginEnabled} signedIn={false} cartBarVisible={showsCartBar} {activePath} />
			<StoreToast message={cart.notice} />
		</div>
	</StoreRoot>
{/if}

<style>
	/*
	 * The iframe viewport stays fixed. The shell inside it scrolls, and it
	 * contains the header, the page, and the footer, so sticky categories and
	 * the footer behave like the live store. Wheel and clicks land on this
	 * scroller instead of a transformed frame that swallows them.
	 */
	:global(html),
	:global(body) {
		margin: 0;
		height: 100%;
		overflow: hidden;
		background: transparent;
	}

	:global(.sf-root) {
		height: 100%;
		min-height: 0 !important;
		max-height: 100%;
		overflow: hidden;
	}

	.preview-boot {
		height: 100%;
		display: grid;
		place-items: center;
		font: 600 0.875rem/1.4 system-ui, sans-serif;
		color: var(--text-3, #878b9c);
		background: transparent;
	}

	.studio-preview-shell {
		height: 100%;
		min-height: 0;
		max-height: 100%;
		display: flex;
		flex-direction: column;
		overflow-x: hidden;
		overflow-y: auto;
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
	}

	.studio-preview-shell::-webkit-scrollbar {
		display: none;
	}

	.studio-preview-shell :global(.sf-main) {
		flex: 1 0 auto;
		overflow: visible;
	}

	.preview-cats {
		display: flex;
		gap: 0.4rem;
		overflow-x: auto;
		padding-bottom: 0.75rem;
		margin-bottom: 0.35rem;
		scrollbar-width: none;
	}

	.preview-cats::-webkit-scrollbar {
		display: none;
	}

	.preview-cat {
		flex: none;
		border: 1px solid var(--sf-border, #333);
		background: var(--sf-surface-2, #1a1f2b);
		color: var(--sf-text-2, #cbd5e1);
		border-radius: 999px;
		padding: 0.35rem 0.75rem;
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
	}

	.preview-cat.active {
		background: var(--sf-primary, #ea580c);
		border-color: transparent;
		color: var(--sf-primary-ink, #fff);
	}

	.preview-back {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border: none;
		background: transparent;
		color: var(--sf-text-2, #94a3b8);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		padding: 0.35rem 0 0.75rem;
	}
</style>
