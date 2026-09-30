<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount, untrack } from 'svelte';
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Megaphone from '@lucide/svelte/icons/megaphone';
	import Info from '@lucide/svelte/icons/info';
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
								style="min-height:32px;font-size:var(--fs-code);padding:0 0.75rem;"
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
				{#if statusMessage}
					{@const broadcast = parseBroadcast(statusMessage)}
					<div class="sf-wrap sf-notice">
						<div class="sf-alert sf-broadcast-alert" data-tone={broadcast.type} role="status">
							{#if broadcast.type === 'alert'}
								<AlertCircle size={17} strokeWidth={2.2} />
							{:else if broadcast.type === 'offer'}
								<Sparkles size={17} strokeWidth={2.2} />
							{:else if broadcast.type === 'others'}
								<Megaphone size={17} strokeWidth={2.2} />
							{:else}
								<Info size={17} strokeWidth={2.2} />
							{/if}
							<div class="sf-broadcast-text">
								{#if broadcast.type === 'offer'}
									<span class="sf-broadcast-badge offer">Special Offer</span>
								{:else if broadcast.type === 'alert'}
									<span class="sf-broadcast-badge alert">Store Notice</span>
								{/if}
								<span>{broadcast.text}</span>
							</div>
						</div>
					</div>
				{:else if showStatusBanner && (storeStatus === 'BUSY' || storeStatus === 'AWAY')}
					<div class="sf-wrap sf-notice">
						<div class="sf-alert" data-tone="warn" role="status">
							<span>{storeStatus === 'BUSY' ? 'Kitchen is currently experiencing high order volume.' : 'Orders are temporarily paused.'}</span>
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
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.3);
		color: #ef4444;
	}

	.sf-broadcast-alert[data-tone='offer'] {
		background: rgba(139, 92, 246, 0.12);
		border: 1px solid rgba(139, 92, 246, 0.3);
		color: #7c3aed;
	}

	.sf-broadcast-alert[data-tone='msg'] {
		background: var(--sf-info-soft, rgba(59, 130, 246, 0.1));
		border: 1px solid color-mix(in srgb, var(--sf-info, #1d4ed8) 28%, transparent);
		color: var(--sf-info, #1d4ed8);
	}

	.sf-broadcast-alert[data-tone='others'] {
		background: var(--sf-warn-soft, rgba(245, 158, 11, 0.1));
		border: 1px solid color-mix(in srgb, var(--sf-warn, #9a5b00) 28%, transparent);
		color: var(--sf-warn, #9a5b00);
	}

	.sf-broadcast-text {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.sf-broadcast-badge {
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 2px 7px;
		border-radius: 4px;
	}

	.sf-broadcast-badge.offer {
		background: #8b5cf6;
		color: #ffffff;
	}

	.sf-broadcast-badge.alert {
		background: #ef4444;
		color: #ffffff;
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
