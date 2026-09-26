<script lang="ts">
	import { page } from '$app/stores';
	import { onMount, untrack } from 'svelte';
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import SuperAdminLogin from '$lib/components/admin/SuperAdminLogin.svelte';
	import '$lib/storefront/storefront.css';
	import { createCart, loadInitialCart, provideCart } from '$lib/storefront/cart-state.svelte';
	import { customerSession } from '$lib/storefront/session.svelte';
	import { FALLBACK_THEME, fontImportFor, hasCompleteTokens, themeVars } from '$lib/storefront/theme';
	import type { StoreProduct } from '$lib/storefront/api';
	import StoreCartBar from '$lib/storefront/StoreCartBar.svelte';
	import StoreFooter from '$lib/storefront/StoreFooter.svelte';
	import StoreHeader from '$lib/storefront/StoreHeader.svelte';
	import StoreRoot from '$lib/storefront/StoreRoot.svelte';
	import StoreTabBar from '$lib/storefront/StoreTabBar.svelte';
	import StoreToast from '$lib/storefront/StoreToast.svelte';

	let { data, children } = $props();

	/**
	 * The storefront shell.
	 *
	 * Header, main, sticky cart bar, bottom navigation and footer, with the cart
	 * held once in context so every screen reads the same live value. The
	 * storefront stylesheet is imported here and nowhere else, which is what keeps
	 * the admin console's own tokens untouched.
	 *
	 * The tenant is resolved from the hostname. No request made from here carries
	 * a tenant id.
	 */
	// The tenant cannot change while this layout is mounted — a storefront URL is
	// the tenant's own subdomain — so the slug is read once and the cart is built
	// against it once. `untrack` makes that intent explicit rather than relying on
	// the reader knowing why the value is safe to capture.
	const slug = untrack(() => data.tenantSlug ?? '');
	const config = $derived(data.config);
	const cart = provideCart(createCart(slug, loadInitialCart(slug)));

	const isTenant = $derived(data.hostKind === 'tenant');

	// The signed-in state lives in localStorage, so it is client-only. The server
	// renders the signed-out header and the client swaps it after mount, which
	// keeps hydration clean without implying a diner has to sign in.
	let signedIn = $state(false);
	let online = $state(true);

	onMount(() => {
		signedIn = Boolean(customerSession.load(slug));
		online = navigator.onLine;
		const goOnline = () => (online = true);
		const goOffline = () => (online = false);
		window.addEventListener('online', goOnline);
		window.addEventListener('offline', goOffline);
		return () => {
			window.removeEventListener('online', goOnline);
			window.removeEventListener('offline', goOffline);
		};
	});

	const theme = $derived(hasCompleteTokens(config?.theme) ? config!.theme : FALLBACK_THEME);
	const fontImport = $derived(fontImportFor(theme.font));
	const currency = $derived(config?.store?.currency ?? 'INR');
	const loginEnabled = $derived(config?.ordering?.customer_login ?? true);
	const pathname = $derived($page.url.pathname);

	/** Search only appears where it can actually filter something. */
	const showSearch = $derived(pathname === '/' || pathname.startsWith('/menu'));

	/**
	 * The search term lives in the URL so a search is shareable, survives a
	 * reload, and is the same on the home and menu pages.
	 */
	let searchTerm = $state('');
	$effect(() => {
		searchTerm = $page.url.searchParams.get('q') ?? '';
	});

	/**
	 * Pages that own the bottom of the screen hide the cart bar. A sticky "View
	 * cart" bar sitting under a "Place order" button is a trap on a small screen.
	 */
	const hidesCartBar = $derived(
		pathname.startsWith('/cart') ||
			pathname.startsWith('/checkout') ||
			pathname.startsWith('/payment') ||
			pathname.startsWith('/order/') ||
			pathname.startsWith('/login') ||
			pathname.startsWith('/verify-otp')
	);

	const showsCartBar = $derived(isTenant && !hidesCartBar && cart.count > 0);

	/** The footer only prints opening hours when the home page is not showing them. */
	const footerShowsHours = $derived(
		!config?.homepage?.sections?.some((section) => section.enabled && section.type === 'OPENING_HOURS')
	);

	// Clear the transient add notice so it never lingers between pages.
	$effect(() => {
		if (!cart.notice) return;
		const timer = setTimeout(() => (cart.notice = ''), 2600);
		return () => clearTimeout(timer);
	});

	function add(product: StoreProduct) {
		cart.add(product, 1);
	}
</script>

<svelte:head>
	<title>{config?.store?.name ? `${config.store.name} · Order pickup` : 'Order pickup'}</title>
	{#if config?.store?.description}
		<meta name="description" content={config.store.description} />
	{/if}
	{#if config?.store?.favicon_url}
		<link rel="icon" href={config.store.favicon_url} />
	{/if}
	<meta name="theme-color" content={theme.primary} />
	<meta name="apple-mobile-web-app-title" content={config?.store?.name ?? 'Order'} />
</svelte:head>

{#if isTenant}
	<StoreRoot {config}>
		<div class="sf-shell">
			<StoreHeader {config} lines={cart.lines} search={showSearch} signedIn={signedIn} loginEnabled={loginEnabled} bind:searchTerm />
			<main class="sf-main" data-has-cart={showsCartBar}>
				{#if data.configError}
					<div class="sf-wrap sf-notice">
						<div class="sf-alert" data-tone="error" role="alert">{data.configError}</div>
					</div>
				{/if}
				{#if !online}
					<div class="sf-wrap sf-notice">
						<div class="sf-alert" data-tone="warn" role="status">
							<WifiOff size={17} strokeWidth={1.9} aria-hidden="true" />
							<span>You are offline. You can browse, but ordering needs a connection.</span>
						</div>
					</div>
				{/if}
				{@render children()}
			</main>
			<StoreFooter {config} showHours={!footerShowsHours} />
			<StoreCartBar lines={cart.lines} {config} totals={cart.totals} visible={showsCartBar} />
			<StoreTabBar lines={cart.lines} />
			<StoreToast message={cart.notice} />
		</div>
	</StoreRoot>
{:else}
	<!-- The platform host keeps its Super Admin entry point. -->
	<SuperAdminLogin />
{/if}
