<script lang="ts">
	import { page } from '$app/stores';
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import House from '@lucide/svelte/icons/house';
	import Receipt from '@lucide/svelte/icons/receipt';
	import User from '@lucide/svelte/icons/user';
	import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
	import { cartCount, type CartLine } from '$lib/storefront/cart.svelte';

	/**
	 * Bottom navigation for a phone.
	 *
	 * Four destinations, thumb-reachable, and only on a phone: from 900px the
	 * header already links everywhere, so the bar is removed in CSS rather than
	 * left to duplicate navigation. The cart tab carries a live count.
	 */
	let { lines = [] }: { lines?: CartLine[] } = $props();

	const count = $derived(cartCount(lines));
	const pathname = $derived($page.url.pathname);

	const tabs = $derived([
		{ href: '/', label: 'Home', icon: House, current: pathname === '/' },
		{ href: '/menu', label: 'Menu', icon: UtensilsCrossed, current: pathname.startsWith('/menu') },
		{ href: '/orders', label: 'Orders', icon: Receipt, current: pathname.startsWith('/orders') },
		{
			href: '/cart',
			label: 'Cart',
			icon: ClipboardList,
			current: pathname.startsWith('/cart'),
			badge: count
		}
	]);
</script>

<nav class="sf-tabbar" aria-label="Primary">
	{#each tabs as tab (tab.href)}
		<a
			class="sf-tab"
			href={tab.href}
			aria-current={tab.current ? 'page' : undefined}
			aria-label={tab.badge ? `${tab.label}, ${tab.badge} items` : tab.label}
		>
			<tab.icon size={21} strokeWidth={tab.current ? 2.2 : 1.8} />
			<span>{tab.label}</span>
			{#if tab.badge && tab.badge > 0}
				<span class="sf-tab-badge">{tab.badge > 99 ? '99+' : tab.badge}</span>
			{/if}
		</a>
	{/each}
</nav>
