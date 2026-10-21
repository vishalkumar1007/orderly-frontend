<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import Search from '@tabler/icons-svelte/icons/search';
	import ShoppingBag from '@tabler/icons-svelte/icons/shopping-bag';
	import User from '@tabler/icons-svelte/icons/user';
	import UtensilsCrossed from '@tabler/icons-svelte/icons/tools-kitchen-2';
	import BuildingStore from '@tabler/icons-svelte/icons/building-store';
	import Calendar from '@tabler/icons-svelte/icons/calendar';
	import Bed from '@tabler/icons-svelte/icons/bed';
	import X from '@tabler/icons-svelte/icons/x';
	import Moon from '@tabler/icons-svelte/icons/moon';
	import Sun from '@tabler/icons-svelte/icons/sun';
	import { useStorefrontThemeToggle } from '$lib/storefront/themeToggle.svelte';
	import type { StoreConfig } from '$lib/storefront/api';
	import { cartCount, type CartLine } from '$lib/storefront/cart.svelte';
	import { experienceFor, type Experience } from '$lib/storefront/experience';

	/**
	 * The storefront header: brand and live status, search where the
	 * catalogue has one, the main section link, account, and the bag when the
	 * business sells things. What it links to comes from the experience.
	 */
	let {
		config,
		exp = undefined as Experience | undefined,
		lines,
		/** Show the search field. Home and menu do; checkout does not. */
		search = false,
		searchTerm = $bindable(''),
		signedIn = false,
		/** Hides the account button where sign-in is switched off. */
		loginEnabled = true,
		/**
		 * Studio embedded preview: search updates the parent in place instead of
		 * navigating the iframe. Brand, menu, and cart links stay so the preview
		 * shell can intercept them.
		 */
		previewMode = false,
		/** Override path for aria-current when embedded outside the store host. */
		activePath = undefined as string | undefined
	}: {
		config: StoreConfig | null;
		exp?: Experience;
		lines: CartLine[];
		search?: boolean;
		searchTerm?: string;
		signedIn?: boolean;
		loginEnabled?: boolean;
		previewMode?: boolean;
		activePath?: string;
	} = $props();

	const x = $derived(exp ?? experienceFor(config));
	/** The one section link: the catalogue to shop, or your bookings. */
	const section = $derived(
		x.family === 'order'
			? { href: x.paths.catalog, label: x.words.catalog, icon: x.variant === 'food' ? UtensilsCrossed : BuildingStore }
			: x.family === 'book'
				? { href: '/bookings', label: x.words.history, icon: Calendar }
				: { href: '/reservations', label: x.words.history, icon: Bed }
	);
	const store = $derived(config?.store ?? null);
	const hours = $derived(config?.hours ?? null);
	const ordering = $derived(config?.ordering ?? null);
	const count = $derived(cartCount(lines));
	const pathname = $derived(activePath ?? $page.url.pathname);

	const storeStatus = $derived(ordering?.store_status ?? (hours?.is_open ? 'OPEN' : 'CLOSED'));
	const statusLabel = $derived(
		ordering?.store_status_label ?? (hours?.is_open ? 'Open Now' : 'Closed')
	);

	const themeToggle = useStorefrontThemeToggle();

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

	/** The search form writes `?q=` so home/menu can filter from the URL. */
	function submitSearch(event: SubmitEvent) {
		event.preventDefault();
		const target = event.currentTarget as HTMLFormElement;
		const value = new FormData(target).get('q')?.toString().trim() ?? '';
		searchTerm = value;
		if (previewMode) return;
		const url = new URL($page.url);
		if (value) url.searchParams.set('q', value);
		else url.searchParams.delete('q');
		void goto(`${url.pathname}${url.search}`, {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	}

	function clearSearch() {
		searchTerm = '';
		if (previewMode) return;
		const url = new URL($page.url);
		url.searchParams.delete('q');
		void goto(`${url.pathname}${url.search}`, {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	}
</script>

<header class="sf-header sf-app-header" data-transparent={config?.theme?.header === 'transparent'}>
	<div class="sf-header-container">
		<div class="sf-header-row">
			<!-- Brand identity -->
			<a class="sf-brand" href="/" aria-label="{store?.name ?? 'Store'} home">
				{#if store?.logo_url}
					<div class="sf-brand-logo-wrap">
						<img class="sf-brand-logo" src={store.logo_url} alt="" width="40" height="40" />
					</div>
				{:else}
					<span class="sf-brand-mark" aria-hidden="true">
						{(store?.name ?? 'S').trim().charAt(0).toUpperCase() || 'S'}
					</span>
				{/if}
				<div class="sf-brand-text">
					<div class="sf-brand-title-wrap">
						<span class="sf-brand-name">{store?.name ?? 'Orderly'}</span>
					</div>
					{#if hours || ordering}
						<div class="sf-brand-meta">
							<span
								class="sf-status-dot sf-status-{statusDotClass}"
								aria-hidden="true"
							></span>
							<span class="sf-status-text">{statusLabel}</span>
							{#if x.family === 'order' && ordering?.prep_time_minutes}
								<span class="sf-prep-time">{ordering.prep_time_minutes} min</span>
							{/if}
						</div>
					{/if}
				</div>
			</a>

			<!-- Center search. On a phone this row is hidden; the mobile row below shows. -->
			{#if search}
				<div class="sf-header-search-wrap sf-desktop-search">
					<form class="sf-search sf-header-search" role="search" onsubmit={submitSearch}>
						<div class="sf-search-field">
							<Search size={17} stroke={1.6} class="sf-search-icon" aria-hidden="true" />
							<input
								type="search"
								name="q"
								bind:value={searchTerm}
								placeholder={x.words.search}
								aria-label={x.words.search}
								enterkeyhint="search"
								autocomplete="off"
							/>
							{#if searchTerm}
								<button class="sf-search-clear" type="button" onclick={clearSearch} aria-label="Clear search">
									<X size={15} stroke={1.6} aria-hidden="true" />
								</button>
							{/if}
						</div>
					</form>
				</div>
			{/if}

			<!-- Right Actions -->
			<div class="sf-header-actions">
				<a
					class="sf-header-link sf-desktop-only"
					href={section.href}
					aria-current={pathname.startsWith(section.href) ? 'page' : undefined}
				>
					<section.icon size={16} stroke={1.6} aria-hidden="true" />
					<span>{section.label}</span>
				</a>

				{#if themeToggle?.enabled}
					<button
						type="button"
						class="sf-icon-btn"
						aria-label={themeToggle.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
						onclick={() => themeToggle.toggle()}
					>
						{#if themeToggle.mode === 'dark'}
							<Sun size={18} stroke={1.6} aria-hidden="true" />
						{:else}
							<Moon size={18} stroke={1.6} aria-hidden="true" />
						{/if}
					</button>
				{/if}

				{#if loginEnabled}
					<a
						class="sf-icon-btn sf-user-btn"
						href={signedIn ? '/profile' : '/login'}
						aria-label={signedIn ? 'Your profile' : 'Sign in'}
						aria-current={pathname === '/profile' || pathname === '/login' ? 'page' : undefined}
						title={signedIn ? 'Your account' : 'Sign in'}
					>
						<User size={19} stroke={1.6} />
					</a>
				{/if}

				{#if x.features.cart}
				<a
					class="sf-cart-btn"
					href="/cart"
					aria-label={count ? `Cart, ${count} items` : 'Cart, empty'}
					aria-current={pathname === '/cart' ? 'page' : undefined}
					data-has-items={String(count > 0)}
				>
					<div class="sf-cart-icon-wrap">
						<ShoppingBag size={19} stroke={1.6} />
						{#if count > 0}
							<span class="sf-cart-badge">{count > 99 ? '99+' : count}</span>
						{/if}
					</div>
					{#if count > 0}
						<span class="sf-cart-label sf-desktop-only">Cart ({count})</span>
					{/if}
				</a>
				{/if}
			</div>
		</div>

		<!-- Mobile Search Row -->
		{#if search}
			<div class="sf-mobile-search">
				<form class="sf-search" role="search" onsubmit={submitSearch}>
					<div class="sf-search-field">
						<Search size={17} stroke={1.6} class="sf-search-icon" aria-hidden="true" />
						<input
							type="search"
							name="q"
							bind:value={searchTerm}
							placeholder={x.words.search}
							aria-label={x.words.search}
							enterkeyhint="search"
							autocomplete="off"
						/>
						{#if searchTerm}
							<button class="sf-search-clear" type="button" onclick={clearSearch} aria-label="Clear search">
								<X size={15} stroke={1.6} aria-hidden="true" />
							</button>
						{/if}
					</div>
				</form>
			</div>
		{/if}
	</div>
</header>
