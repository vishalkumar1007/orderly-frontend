<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import Search from '@lucide/svelte/icons/search';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import User from '@lucide/svelte/icons/user';
	import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
	import X from '@lucide/svelte/icons/x';
	import type { StoreConfig } from '$lib/storefront/api';
	import { cartCount, type CartLine } from '$lib/storefront/cart.svelte';

	/**
	 * Professional Food Order App Storefront Header.
	 *
	 * Includes restaurant brand avatar, live opening status badge with animated radar,
	 * prominent search bar with instant clear, quick menu link, user account button,
	 * and an interactive cart counter.
	 */
	let {
		config,
		lines,
		/** Show the search field. Home and menu do; checkout does not. */
		search = false,
		searchTerm = $bindable(''),
		signedIn = false,
		/** Hides the account button where sign-in is switched off. */
		loginEnabled = true
	}: {
		config: StoreConfig | null;
		lines: CartLine[];
		search?: boolean;
		searchTerm?: string;
		signedIn?: boolean;
		loginEnabled?: boolean;
	} = $props();

	const store = $derived(config?.store ?? null);
	const hours = $derived(config?.hours ?? null);
	const ordering = $derived(config?.ordering ?? null);
	const count = $derived(cartCount(lines));
	const pathname = $derived($page.url.pathname);

	const storeStatus = $derived(ordering?.store_status ?? (hours?.is_open ? 'OPEN' : 'CLOSED'));
	const statusLabel = $derived(
		ordering?.store_status_label ?? (hours?.is_open ? 'Open Now' : 'Closed')
	);

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
							{#if ordering?.prep_time_minutes}
								<span class="sf-status-sep">·</span>
								<span class="sf-prep-time">~{ordering.prep_time_minutes}m</span>
							{/if}
						</div>
					{/if}
				</div>
			</a>

			<!-- Center Search (Desktop / Tablet view) -->
			{#if search}
				<div class="sf-header-search-wrap sf-desktop-search">
					<form class="sf-search sf-header-search" role="search" onsubmit={submitSearch}>
						<div class="sf-search-field">
							<Search size={17} strokeWidth={2.2} class="sf-search-icon" aria-hidden="true" />
							<input
								type="search"
								name="q"
								bind:value={searchTerm}
								placeholder="Search dishes, drinks, or categories..."
								aria-label="Search dishes"
								enterkeyhint="search"
								autocomplete="off"
							/>
							{#if searchTerm}
								<button class="sf-search-clear" type="button" onclick={clearSearch} aria-label="Clear search">
									<X size={15} strokeWidth={2.4} aria-hidden="true" />
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
					href="/menu"
					aria-current={pathname.startsWith('/menu') ? 'page' : undefined}
				>
					<UtensilsCrossed size={16} strokeWidth={2} aria-hidden="true" />
					<span>Menu</span>
				</a>

				{#if loginEnabled}
					<a
						class="sf-icon-btn sf-user-btn"
						href={signedIn ? '/profile' : '/login'}
						aria-label={signedIn ? 'Your profile' : 'Sign in'}
						aria-current={pathname === '/profile' ? 'page' : undefined}
						title={signedIn ? 'Your account' : 'Sign in'}
					>
						<User size={19} strokeWidth={2} />
					</a>
				{/if}

				<a
					class="sf-cart-btn"
					href="/cart"
					aria-label={count ? `Cart, ${count} items` : 'Cart, empty'}
					aria-current={pathname === '/cart' ? 'page' : undefined}
					data-has-items={String(count > 0)}
				>
					<div class="sf-cart-icon-wrap">
						<ShoppingBag size={19} strokeWidth={2.2} />
						{#if count > 0}
							<span class="sf-cart-badge">{count > 99 ? '99+' : count}</span>
						{/if}
					</div>
					{#if count > 0}
						<span class="sf-cart-label sf-desktop-only">Cart ({count})</span>
					{/if}
				</a>
			</div>
		</div>

		<!-- Mobile Search Row -->
		{#if search}
			<div class="sf-mobile-search">
				<form class="sf-search" role="search" onsubmit={submitSearch}>
					<div class="sf-search-field">
						<Search size={17} strokeWidth={2.2} class="sf-search-icon" aria-hidden="true" />
						<input
							type="search"
							name="q"
							bind:value={searchTerm}
							placeholder="Search dishes, drinks, or categories..."
							aria-label="Search dishes"
							enterkeyhint="search"
							autocomplete="off"
						/>
						{#if searchTerm}
							<button class="sf-search-clear" type="button" onclick={clearSearch} aria-label="Clear search">
								<X size={15} strokeWidth={2.4} aria-hidden="true" />
							</button>
						{/if}
					</div>
				</form>
			</div>
		{/if}
	</div>
</header>
