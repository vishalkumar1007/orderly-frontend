<script lang="ts">
	import { page } from '$app/stores';
	import House from '@tabler/icons-svelte/icons/home';
	import Receipt from '@tabler/icons-svelte/icons/receipt';
	import User from '@tabler/icons-svelte/icons/user';
	import UtensilsCrossed from '@tabler/icons-svelte/icons/tools-kitchen-2';
	import BuildingStore from '@tabler/icons-svelte/icons/building-store';
	import Calendar from '@tabler/icons-svelte/icons/calendar';
	import Bed from '@tabler/icons-svelte/icons/bed';
	import type { Experience } from '$lib/storefront/experience';

	/**
	 * Bottom navigation for a phone.
	 *
	 * Cart is intentionally not a tab: the sticky cart bar is the primary CTA
	 * when the cart has items, so a fourth Cart tab would compete with it.
	 * Profile replaces it when login is enabled.
	 *
	 * `activePath` lets Studio's embedded preview highlight the current view
	 * without depending on the real browser URL.
	 */
	let {
		exp = undefined as Experience | undefined,
		loginEnabled = true,
		signedIn = false,
		cartBarVisible = false,
		activePath = undefined as string | undefined
	}: {
		exp?: Experience;
		loginEnabled?: boolean;
		signedIn?: boolean;
		cartBarVisible?: boolean;
		activePath?: string;
	} = $props();

	const pathname = $derived(activePath ?? $page.url.pathname);

	// A shop gets Home, its catalogue and its orders; a booking business
	// gets Home and its bookings, because booking starts from the home page.
	const family = $derived(exp?.family ?? 'order');
	const history = $derived(
		family === 'book'
			? { href: '/bookings', label: 'Bookings', icon: Calendar }
			: family === 'stay'
				? { href: '/reservations', label: 'Stays', icon: Bed }
				: { href: '/orders', label: 'Orders', icon: Receipt }
	);
	const tabs = $derived([
		{ href: '/', label: 'Home', icon: House, current: pathname === '/' },
		...(family === 'order'
			? [
					{
						href: '/menu',
						label: exp?.words.catalog ?? 'Menu',
						icon: exp && exp.variant !== 'food' ? BuildingStore : UtensilsCrossed,
						current: pathname.startsWith('/menu')
					}
				]
			: []),
		{ ...history, current: pathname.startsWith(history.href) },
		...(loginEnabled
			? [
					{
						href: signedIn ? '/profile' : '/login',
						label: signedIn ? 'You' : 'Sign in',
						icon: User,
						current: pathname.startsWith('/profile') || pathname.startsWith('/login')
					}
				]
			: [])
	]);
</script>

<nav class="sf-tabbar" data-cart-bar={String(cartBarVisible)} aria-label="Primary">
	{#each tabs as tab (tab.href)}
		<a
			class="sf-tab"
			href={tab.href}
			aria-current={tab.current ? 'page' : undefined}
			aria-label={tab.label}
		>
			<tab.icon size={21} stroke={1.6} />
			<span>{tab.label}</span>
		</a>
	{/each}
</nav>
