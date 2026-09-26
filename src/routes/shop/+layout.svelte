<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { getAccessToken } from '$lib/api/client';
	import { api } from '$lib/api/client';
	import { logout, me, type User } from '$lib/auth';
	import { TENANT_NAV, tenantCrumbs, tenantTitle } from '$lib/tenant/nav';
	import { orderBoard } from '$lib/tenant/orders.svelte';
	import { activateUpdate, onUpdateAvailable } from '$lib/pwa.svelte';
	import AdminShellSkeleton from '$lib/components/admin/AdminShellSkeleton.svelte';
	import Toaster from '$lib/components/admin/Toaster.svelte';
	import { toast } from '$lib/components/admin/toast';
	import AppShell from '$lib/components/shell/AppShell.svelte';

	let { children, data } = $props();

	type StoreLink = {
		slug: string;
		public_host: string;
		public_path: string;
		is_published: boolean;
		name: string;
	};

	/**
	 * Tri-state so the shell is never rendered for a user we haven't identified —
	 * otherwise the rail and account menu flash for the wrong person. Mirrors the
	 * Super Admin layout.
	 */
	type Status = 'loading' | 'ready' | 'anon';

	let status = $state<Status>('loading');
	let user = $state<User | null>(null);
	let shopName = $state('');
	let storefrontUrl = $state('');

	const isAdmin = $derived(user?.role === 'TENANT_ADMIN');

	/**
	 * Configuration is an admin concern. Staff still get the shell — the kitchen is
	 * their surface — but without the settings or storefront sections.
	 */
	const navGroups = $derived(
		TENANT_NAV.map((group) => ({
			...group,
			items: group.items.filter((item) => {
				if (item.href.startsWith('/shop/settings')) return isAdmin;
				if (item.href.startsWith('/shop/storefront')) return isAdmin;
				return true;
			})
		})).filter((group) => group.items.length > 0)
	);

	$effect(() => {
		// Re-run whenever the route changes: this layout survives client-side
		// navigation, so a one-shot resolve would leave `user` null.
		void $page.url.pathname;

		if (status === 'ready') return;
		if (!getAccessToken()) {
			status = 'anon';
			goto('/shop/login', { replaceState: true });
			return;
		}
		(async () => {
			try {
				const me_ = await me();
				if (me_.role !== 'TENANT_ADMIN' && me_.role !== 'STAFF') {
					status = 'anon';
					goto('/shop/login', { replaceState: true });
					return;
				}
				user = me_;
				status = 'ready';
			} catch {
				status = 'anon';
				goto('/shop/login', { replaceState: true });
			}
		})();
	});

	// Shop identity drives the rail header and the storefront link.
	$effect(() => {
		if (status !== 'ready') return;
		let cancelled = false;
		(async () => {
			try {
				const link = await api<StoreLink>('/api/v1/tenant/store-link');
				if (cancelled) return;
				shopName = link.name || data.tenantSlug || 'Your shop';
				storefrontUrl = `http://${link.public_host}${link.public_path}`;
			} catch {
				if (!cancelled) shopName = data.tenantSlug ?? 'Your shop';
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	const crumbs = $derived(tenantCrumbs($page.url.pathname));
	const title = $derived(tenantTitle($page.url.pathname));
	const railName = $derived(shopName || data.tenantSlug || 'Your shop');

	/** Orders needing attention, surfaced in the topbar. */
	const needsAttention = $derived(orderBoard.activeCount);

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
		await logout();
		user = null;
		status = 'anon';
		goto('/shop/login', { replaceState: true });
	}
</script>

{#if status === 'anon'}
	<!-- Signed out: hold a blank frame while the redirect lands. -->
	<div style="min-height:100dvh;"></div>
{:else if status === 'ready' && user}
	<AppShell
		brandName={railName}
		userEmail={user.email}
		userName={user.name}
		role={user.role}
		pathname={$page.url.pathname}
		{crumbs}
		{title}
		navLabel="Organization"
		groups={navGroups}
		storageKey="orderly-shop-rail"
		onSignOut={signOut}
	>
		{#snippet actions()}
			{#if needsAttention > 0}
				<a class="btn btn-ghost btn-sm" href="/shop/orders">
					{needsAttention} open {needsAttention === 1 ? 'order' : 'orders'}
				</a>
			{/if}
			{#if storefrontUrl}
				<a class="btn btn-ghost btn-sm" href={storefrontUrl} target="_blank" rel="noreferrer">
					View storefront
				</a>
			{/if}
		{/snippet}

		{@render children()}
	</AppShell>
	<Toaster />
{:else}
	<!-- Shell-shaped so the frame doesn't jump when identity resolves. -->
	<AdminShellSkeleton />
{/if}
