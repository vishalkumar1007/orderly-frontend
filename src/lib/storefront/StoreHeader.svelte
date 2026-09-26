<script lang="ts">
	import { page } from '$app/stores';
	import Search from '@lucide/svelte/icons/search';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import User from '@lucide/svelte/icons/user';
	import type { StoreConfig } from '$lib/storefront/api';
	import { cartCount, type CartLine } from '$lib/storefront/cart.svelte';
	import { money } from '$lib/storefront/format';

	/**
	 * The storefront header.
	 *
	 * Compact by design: logo, store name, live open/closed state, search and a
	 * cart button. The search field only appears where the page can use it, so the
	 * header never carries a control that does nothing.
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
	const count = $derived(cartCount(lines));
	const pathname = $derived($page.url.pathname);

	/** The search form is a real GET so a search is shareable and bookmarkable. */
	function submitSearch(event: SubmitEvent) {
		event.preventDefault();
		const target = event.currentTarget as HTMLFormElement;
		const value = new FormData(target).get('q')?.toString().trim() ?? '';
		searchTerm = value;
	}
</script>

<header class="sf-header" data-transparent={config?.theme?.header === 'transparent'}>
	<div class="sf-header-row">
		<a class="sf-brand" href="/">
			{#if store?.logo_url}
				<img class="sf-brand-logo" src={store.logo_url} alt="" width="34" height="34" />
			{:else}
				<span class="sf-brand-mark" aria-hidden="true">
					{(store?.name ?? 'S').trim().charAt(0).toUpperCase() || 'S'}
				</span>
			{/if}
			<span class="sf-brand-text">
				<span class="sf-brand-name">{store?.name ?? 'Orderly'}</span>
				{#if hours}
					<span class="sf-brand-meta">
						<span class="sf-open-dot" data-open={String(hours.is_open)} aria-hidden="true"></span>
						{hours.is_open ? 'Open' : 'Closed'}
					</span>
				{/if}
			</span>
		</a>

		<div class="sf-header-actions">
			{#if loginEnabled}
				<a
					class="sf-icon-btn"
					href={signedIn ? '/profile' : '/login'}
					aria-label={signedIn ? 'Your profile' : 'Sign in with phone'}
					aria-current={pathname === '/profile' ? 'page' : undefined}
				>
					<User size={20} strokeWidth={1.9} />
				</a>
			{/if}
			<a
				class="sf-icon-btn"
				href="/cart"
				aria-label={count ? `Cart, ${count} items` : 'Cart, empty'}
				aria-current={pathname === '/cart' ? 'page' : undefined}
			>
				<ShoppingBag size={20} strokeWidth={1.9} />
				{#if count > 0}
					<span class="sf-cart-count">{count > 99 ? '99+' : count}</span>
				{/if}
			</a>
		</div>
	</div>

	{#if search}
		<form class="sf-search" role="search" onsubmit={submitSearch}>
			<div class="sf-search-field">
				<Search size={17} strokeWidth={1.9} aria-hidden="true" />
				<input
					type="search"
					name="q"
					bind:value={searchTerm}
					placeholder="Search the menu"
					aria-label="Search the menu"
					enterkeyhint="search"
					autocomplete="off"
				/>
				{#if searchTerm}
					<button class="sf-search-clear" type="button" onclick={() => (searchTerm = '')}>
						<span class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);">
							Clear search
						</span>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
							<path d="M18 6 6 18M6 6l12 12" />
						</svg>
					</button>
				{/if}
			</div>
		</form>
	{/if}
</header>
