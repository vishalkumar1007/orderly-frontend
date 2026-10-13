<script lang="ts">
	import { page } from '$app/stores';
	import House from '@tabler/icons-svelte/icons/home';
	import Receipt from '@tabler/icons-svelte/icons/receipt';
	import User from '@tabler/icons-svelte/icons/user';
	import UtensilsCrossed from '@tabler/icons-svelte/icons/tools-kitchen-2';

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
		loginEnabled = true,
		signedIn = false,
		cartBarVisible = false,
		activePath = undefined as string | undefined
	}: {
		loginEnabled?: boolean;
		signedIn?: boolean;
		cartBarVisible?: boolean;
		activePath?: string;
	} = $props();

	const pathname = $derived(activePath ?? $page.url.pathname);

	const tabs = $derived([
		{ href: '/', label: 'Home', icon: House, current: pathname === '/' },
		{
			href: '/menu',
			label: 'Menu',
			icon: UtensilsCrossed,
			current: pathname.startsWith('/menu')
		},
		{
			href: '/orders',
			label: 'Orders',
			icon: Receipt,
			current: pathname.startsWith('/orders')
		},
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
