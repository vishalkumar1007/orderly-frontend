<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Menu from '@lucide/svelte/icons/menu';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import X from '@lucide/svelte/icons/x';
	import { logout, type User } from '$lib/auth';
	import { toast } from '$lib/components/admin/toast';
	import { orderBoard } from '$lib/tenant/orders.svelte';
	import { isActive, SHOP_NAV, SHOP_TABS, titleFor, type ShopNavItem } from '$lib/tenant/nav';
	import { activateUpdate, isOnline, onUpdateAvailable } from '$lib/pwa.svelte';

	let {
		shopName = '',
		shopInitial = 'O',
		storefrontUrl = '',
		/** Page title shown in the app bar. Defaults to the current route. */
		title = '',
		/** Optional line under the title, e.g. "12 live orders". */
		subtitle = '',
		user = null as User | null,
		/** Rendered on the right of the app bar (buttons, filters). */
		actions,
		/** Hides the refresh button where a screen owns its own polling. */
		showRefresh = false,
		children
	}: {
		shopName?: string;
		shopInitial?: string;
		storefrontUrl?: string;
		title?: string;
		subtitle?: string;
		user?: User | null;
		actions?: Snippet;
		showRefresh?: boolean;
		children: Snippet;
	} = $props();

	let drawerOpen = $state(false);
	let signingOut = $state(false);

	const pathname = $derived($page.url.pathname);
	const barTitle = $derived(title || titleFor(pathname, shopName));
	const online = $derived(isOnline());
	const initials = $derived(
		(user?.name || user?.email || shopName || '?')
			.split(/[\s@._-]+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase() ?? '')
			.join('') || '?'
	);

	function badgeFor(item: ShopNavItem): number {
		if (item.badge === 'active') return orderBoard.activeCount;
		if (item.badge === 'new') return orderBoard.newCount;
		return 0;
	}

	// Close the drawer whenever the route changes.
	$effect(() => {
		pathname;
		drawerOpen = false;
	});

	// Lock the page behind the drawer, and close it on Escape.
	$effect(() => {
		if (!drawerOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') drawerOpen = false;
		};
		document.addEventListener('keydown', onKey);
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.removeEventListener('keydown', onKey);
			document.body.style.overflow = prev;
		};
	});

	onMount(() => {
		// A new build is ready — offer it instead of swapping mid-order.
		return onUpdateAvailable(() => {
			toast.show({
				message: 'A new version of Orderly is ready',
				action: { label: 'Reload', onClick: () => activateUpdate() },
				duration: 0
			});
		});
	});

	async function signOut() {
		if (signingOut) return;
		signingOut = true;
		try {
			await logout();
			goto('/shop/login');
		} catch {
			// Even if the server call fails, clearTokens() has already run.
			goto('/shop/login');
		} finally {
			signingOut = false;
		}
	}
</script>

<div class="oshell">
	{#if drawerOpen}
		<button class="osrail-scrim" aria-label="Close menu" onclick={() => (drawerOpen = false)}></button>
	{/if}

	<aside class={['osrail', drawerOpen ? 'open' : ''].join(' ')}>
		<div class="osrail-head">
			<span class="osrail-mark">{shopInitial}</span>
			<div class="osrail-titles">
				<p class="osrail-title">{shopName || 'Your shop'}</p>
				<p class="osrail-sub">Shop admin</p>
			</div>
			<button class="osrail-close" aria-label="Close menu" onclick={() => (drawerOpen = false)}>
				<X size={17} strokeWidth={1.9} />
			</button>
		</div>

		<nav class="osrail-nav" aria-label="Shop">
			{#each SHOP_NAV as group (group.label ?? 'main')}
				<div class="osrail-group">
					{#if group.label}<div class="osrail-group-label">{group.label}</div>{/if}
					{#each group.items as item (item.href)}
						{@const count = badgeFor(item)}
						<a
							class={['osrail-link', isActive(pathname, item) ? 'active' : ''].join(' ')}
							href={item.href}
							aria-current={isActive(pathname, item) ? 'page' : undefined}
						>
							<span class="osrail-link-icon">
								<item.icon size={18} strokeWidth={1.85} />
							</span>
							<span class="osrail-link-label">{item.label}</span>
							{#if count > 0}
								<span class="osrail-link-badge">{count}</span>
							{/if}
						</a>
					{/each}
				</div>
			{/each}
		</nav>

		<div class="osrail-foot">
			<span class="osrail-user">
				<span class="osrail-avatar">{initials}</span>
				<span class="osrail-user-txt">
					<strong>{user?.name || user?.email || 'Signed in'}</strong>
					<span>{user?.role === 'STAFF' ? 'Staff' : 'Owner'}</span>
				</span>
			</span>
			<button
				class="osrail-signout"
				aria-label="Sign out"
				title="Sign out"
				disabled={signingOut}
				onclick={signOut}
			>
				<LogOut size={16} strokeWidth={1.85} />
			</button>
		</div>
	</aside>

	<div class="osmain">
		<header class="ostopbar">
			<div class="ostopbar-inner">
				<button
					class="osburger"
					aria-label="Open menu"
					aria-expanded={drawerOpen}
					onclick={() => (drawerOpen = true)}
				>
					<Menu size={19} strokeWidth={1.85} />
				</button>

				<div class="ostopbar-titles">
					<h1 class="ostopbar-title">{barTitle}</h1>
					{#if subtitle || storefrontUrl}
						<p class="ostopbar-sub">{subtitle || storefrontUrl}</p>
					{/if}
				</div>

				<div class="ostopbar-actions">
					{#if !online}
						<span class="oschip warn" title="You are offline">
							<WifiOff size={13} strokeWidth={2} />
							Offline
						</span>
					{/if}
					{#if actions}{@render actions()}{/if}
					{#if showRefresh}
						<button
							class="osburger"
							aria-label="Refresh"
							title="Refresh"
							onclick={() => void orderBoard.refresh()}
						>
							<RefreshCw size={16} strokeWidth={1.85} />
						</button>
					{/if}
				</div>
			</div>
		</header>

		<div class="oscontent">
			{@render children()}
		</div>
	</div>

	<nav class="ostabbar" aria-label="Primary">
		{#each SHOP_TABS as tab (tab.href)}
			{@const count = badgeFor(tab)}
			<a
				class={['ostab', isActive(pathname, tab) ? 'active' : ''].join(' ')}
				href={tab.href}
				aria-current={isActive(pathname, tab) ? 'page' : undefined}
			>
				<span class="ostab-icon">
					<tab.icon size={19} strokeWidth={isActive(pathname, tab) ? 2.1 : 1.8} />
					{#if count > 0}<span class="ostab-badge">{count}</span>{/if}
				</span>
				<span class="ostab-label">{tab.label}</span>
			</a>
		{/each}
		<button
			class={['ostab', drawerOpen ? 'active' : ''].join(' ')}
			onclick={() => (drawerOpen = true)}
			aria-label="More options"
			aria-expanded={drawerOpen}
		>
			<span class="ostab-icon"><Ellipsis size={19} strokeWidth={1.8} /></span>
			<span class="ostab-label">More</span>
		</button>
	</nav>
</div>
