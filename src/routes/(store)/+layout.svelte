<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount, untrack } from 'svelte';
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import SuperAdminLogin from '$lib/components/admin/SuperAdminLogin.svelte';
	import '$lib/storefront/storefront-app.css';
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

	const slug = untrack(() => data.tenantSlug ?? '');
	const config = $derived(data.config);
	const cart = provideCart(createCart(slug, loadInitialCart(slug)));

	const isTenant = $derived(data.hostKind === 'tenant');
	/** API said the shop is unpublished / not found — intentional empty state. */
	const isUnpublished = $derived(isTenant && !config && data.configErrorCode === 'not_found');
	/**
	 * Config failed for a transient reason (network, 5xx, timeout). Show a
	 * degraded shell with FALLBACK_THEME — never confuse this with unpublished.
	 */
	const isConfigError = $derived(
		isTenant && !config && Boolean(data.configError) && data.configErrorCode !== 'not_found'
	);
	const canBrowse = $derived(isTenant && (config !== null || isConfigError));

	let signedIn = $state(false);
	let online = $state(true);
	let retrying = $state(false);

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
	const loginEnabled = $derived(
		(config?.ordering?.customer_login_mode ?? (config?.ordering?.customer_login ? 'optional' : 'off')) !==
			'off'
	);
	const pathname = $derived($page.url.pathname);

	const storeStatus = $derived(config?.ordering?.store_status ?? 'OPEN');
	const statusMessage = $derived(config?.ordering?.status_message_display ?? '');
	const showStatusBanner = $derived(storeStatus === 'BUSY' || storeStatus === 'AWAY');

	const showSearch = $derived(pathname === '/' || pathname.startsWith('/menu'));

	let searchTerm = $state('');
	$effect(() => {
		searchTerm = $page.url.searchParams.get('q') ?? '';
	});

	const hidesCartBar = $derived(
		pathname.startsWith('/cart') ||
			pathname.startsWith('/checkout') ||
			pathname.startsWith('/payment') ||
			pathname.startsWith('/order/') ||
			pathname.startsWith('/login') ||
			pathname.startsWith('/verify-otp')
	);

	const showsCartBar = $derived(canBrowse && config !== null && !hidesCartBar && cart.count > 0);

	const footerShowsHours = $derived(
		!config?.homepage?.sections?.some((section) => section.enabled && section.type === 'OPENING_HOURS')
	);

	$effect(() => {
		if (!cart.notice) return;
		const timer = setTimeout(() => (cart.notice = ''), 2600);
		return () => clearTimeout(timer);
	});

	function add(product: StoreProduct) {
		cart.add(product, 1);
	}

	async function retryConfig() {
		retrying = true;
		try {
			await invalidateAll();
		} finally {
			retrying = false;
		}
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
	{#if fontImport}
		<link rel="stylesheet" href={fontImport} />
	{/if}
	<meta name="theme-color" content={theme.primary} />
	<meta name="apple-mobile-web-app-title" content={config?.store?.name ?? 'Order'} />
</svelte:head>

{#if !isTenant}
	<SuperAdminLogin />
{:else if isUnpublished && !isConfigError}
	<div class="sf-unpublished">
		<div class="sf-unpublished-inner">
			<div class="sf-unpublished-icon" aria-hidden="true">
				<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10" />
					<path d="M8 12h8" />
				</svg>
			</div>
			<h1>Shopfront not yet published</h1>
			<p>This store hasn't been set up yet. Please check back later.</p>
		</div>
	</div>
{:else if canBrowse}
	<StoreRoot {config} tenantSlug={slug}>
		<div class="sf-shell">
			<StoreHeader {config} lines={cart.lines} search={showSearch} signedIn={signedIn} loginEnabled={loginEnabled} bind:searchTerm />
			<main class="sf-main" data-has-cart={showsCartBar}>
				{#if isConfigError || data.configError}
					<div class="sf-wrap sf-notice">
						<div
							class="sf-alert"
							data-tone="error"
							role="alert"
							style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;"
						>
							<span>{data.configError || 'Could not load this store right now.'}</span>
							<button
								class="sf-btn sf-btn-secondary"
								type="button"
								style="min-height:32px;font-size:0.75rem;padding:0 0.75rem;"
								disabled={retrying}
								onclick={() => void retryConfig()}
							>
								{retrying ? 'Retrying…' : 'Try again'}
							</button>
						</div>
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
				{#if showStatusBanner && statusMessage}
					<div class="sf-wrap sf-notice">
						<div class="sf-alert" data-tone="info" role="status">
							<span>{statusMessage}</span>
						</div>
					</div>
				{/if}
				{@render children()}
			</main>
			<StoreFooter {config} showHours={!footerShowsHours} />
			<StoreCartBar lines={cart.lines} {config} totals={cart.totals} visible={showsCartBar} />
			<StoreTabBar
				{loginEnabled}
				{signedIn}
				cartBarVisible={showsCartBar}
			/>
			<StoreToast message={cart.notice} />
		</div>
	</StoreRoot>
{:else}
	<div class="sf-unpublished">
		<div class="sf-unpublished-inner">
			<h1>Shopfront unavailable</h1>
			<p>{data.configError || 'Please try again in a moment.'}</p>
			<button class="sf-btn sf-btn-primary" type="button" style="margin-top:1rem;" disabled={retrying} onclick={() => void retryConfig()}>
				{retrying ? 'Retrying…' : 'Try again'}
			</button>
		</div>
	</div>
{/if}

<style>
	.sf-unpublished {
		min-height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		background: var(--bg);
	}

	.sf-unpublished-inner {
		text-align: center;
		max-width: 400px;
	}

	.sf-unpublished-icon {
		display: grid;
		place-items: center;
		width: 64px;
		height: 64px;
		margin: 0 auto 1.25rem;
		border-radius: 50%;
		background: var(--surface-2);
		color: var(--text-3);
	}

	.sf-unpublished h1 {
		margin: 0 0 0.5rem;
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--text);
	}

	.sf-unpublished p {
		margin: 0;
		font-size: 0.875rem;
		color: var(--text-2);
		line-height: 1.5;
	}
</style>
