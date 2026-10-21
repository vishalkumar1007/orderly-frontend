<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount, untrack } from 'svelte';
	import WifiOff from '@tabler/icons-svelte/icons/wifi-off';
	import AlertCircle from '@tabler/icons-svelte/icons/alert-circle';
	import Sparkles from '@tabler/icons-svelte/icons/sparkles';
	import Megaphone from '@tabler/icons-svelte/icons/speakerphone';
	import Info from '@tabler/icons-svelte/icons/info-circle';
	import SuperAdminLogin from '$lib/components/admin/SuperAdminLogin.svelte';
	import ServiceError from '$lib/components/ServiceError.svelte';
	import '$lib/storefront/storefront-app.css';
	import { createCart, loadInitialCart, provideCart } from '$lib/storefront/cart-state.svelte';
	import { captureAttribution } from '$lib/storefront/api';
	import { customerSession } from '$lib/storefront/session.svelte';
	import { FALLBACK_THEME, fontImportFor, hasCompleteTokens, themeVars } from '$lib/storefront/theme';
	import type { StoreProduct } from '$lib/storefront/api';
	import StoreCartBar from '$lib/storefront/StoreCartBar.svelte';
	import StoreFooter from '$lib/storefront/StoreFooter.svelte';
	import StoreHeader from '$lib/storefront/StoreHeader.svelte';
	import StoreRoot from '$lib/storefront/StoreRoot.svelte';
	import StoreTabBar from '$lib/storefront/StoreTabBar.svelte';
	import StoreToast from '$lib/storefront/StoreToast.svelte';
	import { experienceFor } from '$lib/storefront/experience';

	let { data, children } = $props();

	function parseBroadcast(msg: string) {
		if (!msg) return { type: 'msg', text: '' };
		const match = msg.match(/^\[(alert|msg|offer|others)\]\s*(.*)$/i);
		if (match) {
			return { type: match[1].toLowerCase(), text: match[2] };
		}
		return { type: 'msg', text: msg };
	}

	const slug = untrack(() => data.tenantSlug ?? '');
	const config = $derived(data.config);
	const cart = provideCart(createCart(slug, loadInitialCart(slug)));

	const isTenant = $derived(data.hostKind === 'tenant');
	/** API said the shop is unpublished / not found: intentional empty state. */
	const isUnpublished = $derived(
		isTenant && !config && (data.configErrorCode === 'not_found' || data.configErrorStatus === 404)
	);
	const isUnknownShop = $derived(data.configErrorCode === 'tenant_not_found');
	/** Only a loaded config is browsable; any other failure blocks with ServiceError. */
	const canBrowse = $derived(isTenant && config !== null);

	// Follows the session store, so the header, tab bar and footer flip the
	// moment someone signs in or out, not on the next full reload.
	const signedIn = $derived($customerSession !== null);
	let online = $state(true);

	onMount(() => {
		customerSession.load(slug);
		captureAttribution($page.url.searchParams);
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
	const exp = $derived(experienceFor(config));
	const loginEnabled = $derived(exp.features.signIn);
	const pathname = $derived($page.url.pathname);

	const storeStatus = $derived(config?.ordering?.store_status ?? 'OPEN');
	const statusMessage = $derived(config?.ordering?.status_message_display ?? '');
	const showStatusBanner = $derived(storeStatus === 'BUSY' || storeStatus === 'AWAY');

	const showSearch = $derived(exp.features.search && (pathname === '/' || pathname.startsWith('/menu')));

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

	const showsCartBar = $derived(
		canBrowse && config !== null && exp.features.cart && !hidesCartBar && cart.count > 0
	);

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

	function retryConfig() {
		return invalidateAll();
	}
</script>

<svelte:head>
	<title>{config?.store?.name ? `${config.store.name} | ${exp.words.title}` : exp.words.title}</title>
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
{:else if isUnpublished}
	<div class="sf-unpublished">
		<div class="sf-unpublished-inner">
			<div class="sf-unpublished-icon" aria-hidden="true">
				<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10" />
					<path d="M8 12h8" />
				</svg>
			</div>
			{#if isUnknownShop}
				<h1>Shop not found</h1>
				<p>There is no shop at this address. Check the link and try again.</p>
			{:else}
				<h1>Shopfront not yet published</h1>
				<p>This store hasn't been set up yet. Please check back later.</p>
			{/if}
		</div>
	</div>
{:else if canBrowse}
	<StoreRoot {config} tenantSlug={slug}>
		<div class="sf-shell">
			<StoreHeader {config} {exp} lines={cart.lines} search={showSearch} signedIn={signedIn} loginEnabled={loginEnabled} bind:searchTerm />
			<main class="sf-main" data-has-cart={showsCartBar}>
				{#if !online}
					<div class="sf-wrap sf-notice">
						<div class="sf-alert" data-tone="warn" role="status">
							<WifiOff size={17} stroke={1.6} aria-hidden="true" />
							<span>You are offline. You can browse, but ordering needs a connection.</span>
						</div>
					</div>
				{/if}
				{#if statusMessage}
					{@const broadcast = parseBroadcast(statusMessage)}
					<div class="sf-wrap sf-notice">
						<div class="sf-alert sf-broadcast-alert" data-tone={broadcast.type} role="status">
							{#if broadcast.type === 'alert'}
								<AlertCircle size={17} stroke={1.6} />
							{:else if broadcast.type === 'offer'}
								<Sparkles size={17} stroke={1.6} />
							{:else if broadcast.type === 'others'}
								<Megaphone size={17} stroke={1.6} />
							{:else}
								<Info size={17} stroke={1.6} />
							{/if}
							<div class="sf-broadcast-text">
								<span>{broadcast.text}</span>
							</div>
						</div>
					</div>
				{:else if showStatusBanner && (storeStatus === 'BUSY' || storeStatus === 'AWAY')}
					<div class="sf-wrap sf-notice">
						<div class="sf-alert" data-tone="warn" role="status">
							<span>{storeStatus === 'BUSY' ? exp.words.busy : exp.family === 'order' ? 'Orders are paused for now.' : 'Online booking is paused for now.'}</span>
						</div>
					</div>
				{/if}
				{@render children()}
			</main>
			<StoreFooter {config} {signedIn} showHours={footerShowsHours} />
			<StoreCartBar lines={cart.lines} {config} totals={cart.totals} visible={showsCartBar} />
			<StoreTabBar
				{exp}
				{loginEnabled}
				{signedIn}
				cartBarVisible={showsCartBar}
			/>
			<StoreToast message={cart.notice} />
		</div>
	</StoreRoot>
{:else}
	<ServiceError
		code={data.configErrorCode}
		status={data.configErrorStatus}
		message={data.configError}
		onRetry={retryConfig}
	/>
{/if}

<style>
	.sf-broadcast-alert {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-radius: var(--radius-md, 10px);
		font-size: var(--fs-body, 0.875rem);
		line-height: 1.4;
	}

	.sf-broadcast-alert[data-tone='alert'] {
		background: var(--sf-danger-soft);
		border: 1px solid color-mix(in srgb, var(--sf-danger) 28%, transparent);
		color: var(--sf-danger);
	}

	/* Offers wear the shop's own colour. */
	.sf-broadcast-alert[data-tone='offer'] {
		background: color-mix(in srgb, var(--sf-primary) 14%, var(--sf-surface));
		border: 1px solid color-mix(in srgb, var(--sf-primary) 30%, transparent);
		color: var(--sf-text);
		font-weight: 500;
	}

	.sf-broadcast-alert[data-tone='offer'] :global(svg) {
		color: var(--sf-primary);
		flex: none;
	}

	.sf-broadcast-alert[data-tone='msg'] {
		background: var(--sf-info-soft);
		border: 1px solid color-mix(in srgb, var(--sf-info) 28%, transparent);
		color: var(--sf-info);
	}

	.sf-broadcast-alert[data-tone='others'] {
		background: var(--sf-warn-soft);
		border: 1px solid color-mix(in srgb, var(--sf-warn) 28%, transparent);
		color: var(--sf-warn);
	}

	.sf-broadcast-text {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

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
		font-size: var(--fs-h1);
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--text);
	}

	.sf-unpublished p {
		margin: 0;
		font-size: var(--fs-body);
		color: var(--text-2);
		line-height: 1.5;
	}
</style>
