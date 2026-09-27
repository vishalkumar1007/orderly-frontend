<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { api } from '$lib/api/client';
	import { applyBrandTheme, clearBrandTheme, type BrandTheme } from '$lib/brandTheme';
	import { initConnectivity, initInstallPrompt, registerServiceWorker } from '$lib/pwa.svelte';
	import { initTheme } from '$lib/theme';

	let { children } = $props();

	/** Only shop hosts get the installable app shell; the platform console does not. */
	const isTenantHost = $derived($page.data.hostKind === 'tenant');

	/**
	 * Head tags live here, not in the route layouts.
	 *
	 * SvelteKit renders a parent layout's `<svelte:head>` *after* its children, so
	 * a title set in both places would leave the parent's winning. Because layout
	 * data merges down, this root already has the storefront's config, so it can
	 * own the title and the browser chrome colour for every area in one place.
	 */
	type StoreConfigLike = {
		store?: { name?: string; favicon_url?: string };
		theme?: { primary?: string };
	} | null;

	const storeConfig = $derived(($page.data as { config?: StoreConfigLike }).config ?? null);
	const documentTitle = $derived(
		storeConfig?.store?.name
			? `${storeConfig.store.name} · Order pickup`
			: isTenantHost
				? 'Orderly'
				: 'Orderly · Platform console'
	);
	const themeColor = $derived(storeConfig?.theme?.primary ?? '#6366f1');

	onMount(() => {
		initTheme();
		initConnectivity();
		initInstallPrompt();
		registerServiceWorker();
	});

	/**
	 * Boolean, not the full pathname: navigating /shop → /shop/menu must not
	 * re-fetch theme. An earlier effect tracked `$page.url.pathname` and hit
	 * `/api/v1/tenant/theme` on every console navigation, which felt like the
	 * whole shell was "loading" again even though Go answered quickly.
	 */
	const onShopConsole = $derived($page.url.pathname.startsWith('/shop'));

	$effect(() => {
		const kind = $page.data.hostKind;
		const shopConsole = onShopConsole;

		// Platform + admin hosts own their own theme. Strip any tenant override
		// so the Super Admin console never inherits a shop's brand.
		if (kind !== 'tenant') {
			clearBrandTheme();
			return;
		}

		let cancelled = false;
		(async () => {
			try {
				// Console appearance (admin brand) only applies on /shop/* routes.
				// The public storefront uses --sf-* tokens from StoreRoot — never
				// run applyBrandTheme on a storefront theme payload.
				if (shopConsole) {
					const theme = await api<BrandTheme>('/api/v1/tenant/theme');
					if (!cancelled) applyBrandTheme(theme);
					return;
				}
				clearBrandTheme();
			} catch {
				/* unpublished store or signed-out shop */
			}
		})();
		return () => {
			cancelled = true;
		};
	});
</script>

<svelte:head>
	<title>{documentTitle}</title>
	<script>
		// Initialize theme before first paint to prevent flash
		(function() {
			var stored = localStorage.getItem('orderly-theme');
			var theme = stored === 'dark' || stored === 'light' ? stored : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
			document.documentElement.dataset.theme = theme;
		})();
	</script>
	<link rel="icon" href={storeConfig?.store?.favicon_url ?? favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@600;700;800&display=swap"
		rel="stylesheet"
	/>

	<!-- Standalone / installed-app behaviour -->
	<meta name="theme-color" content={themeColor} />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<meta name="apple-mobile-web-app-title" content={storeConfig?.store?.name ?? 'Orderly'} />
	<meta name="application-name" content="Orderly" />
	<meta name="format-detection" content="telephone=no" />
	<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />

	{#if isTenantHost}
		<link rel="manifest" href="/manifest.webmanifest" />
	{/if}
</svelte:head>

{@render children()}
