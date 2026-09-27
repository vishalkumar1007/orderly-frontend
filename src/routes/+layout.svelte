<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { api, getAccessToken } from '$lib/api/client';
	import {
		applyBrandTheme,
		clearBrandTheme,
		getCachedBrandTheme,
		invalidateBrandThemeCache,
		setCachedBrandTheme,
		type BrandTheme
	} from '$lib/brandTheme';
	import { initConnectivity, initInstallPrompt, registerServiceWorker } from '$lib/pwa.svelte';
	import { initTheme } from '$lib/theme';

	let { children } = $props();

	/** Only shop hosts get the installable app shell; the platform console does not. */
	const hostKind = $derived($page.data.hostKind as string | undefined);
	const tenantSlug = $derived(($page.data as { tenantSlug?: string }).tenantSlug ?? '');
	const pathname = $derived($page.url.pathname);
	const isTenantHost = $derived(hostKind === 'tenant');

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
	 * Depend only on derived primitives — reading `$page` inside the effect
	 * re-runs on every client navigation and re-hit `/tenant/theme`.
	 */
	const onShopConsole = $derived(pathname.startsWith('/shop'));
	const onShopPublic = $derived(
		pathname === '/shop/login' || pathname.startsWith('/setup-password')
	);

	$effect(() => {
		const kind = hostKind;
		const slug = tenantSlug;
		const shopConsole = onShopConsole;
		const isPublic = onShopPublic;

		// Platform + admin hosts own their own theme. Strip any tenant override
		// so the Super Admin console never inherits a shop's brand.
		if (kind !== 'tenant') {
			clearBrandTheme();
			invalidateBrandThemeCache();
			return;
		}

		// Console appearance only applies on authenticated /shop/* routes.
		// The public storefront uses --sf-* tokens from StoreRoot.
		if (!shopConsole) {
			clearBrandTheme();
			return;
		}

		if (isPublic) return;

		const cacheKey = slug || 'tenant';
		const cached = getCachedBrandTheme(cacheKey);
		if (cached) {
			applyBrandTheme(cached);
			return;
		}

		// No staff session → skip authenticated theme (avoids 401 → clearTokens).
		if (typeof localStorage !== 'undefined' && !getAccessToken()) return;

		let cancelled = false;
		(async () => {
			try {
				const theme = await api<BrandTheme>('/api/v1/tenant/theme');
				if (cancelled) return;
				applyBrandTheme(theme);
				setCachedBrandTheme(cacheKey, theme);
			} catch {
				/* unpublished store or signed-out shop — do not auto-retry */
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
