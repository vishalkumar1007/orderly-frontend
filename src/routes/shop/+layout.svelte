<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import ChefHat from '@lucide/svelte/icons/chef-hat';
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import { getAccessToken } from '$lib/api/client';
	import { api } from '$lib/api/client';
	import { logout, me, type User } from '$lib/auth';
	import {
		STAFF_OPS_HREFS,
		TENANT_NAV,
		isOpsFullscreenPath,
		tenantCrumbs,
		tenantTitle
	} from '$lib/tenant/nav';
	import { orderBoard } from '$lib/tenant/orders.svelte';
	import { invalidateDashboardSnapshot } from '$lib/tenant/dashboardCache.svelte';
	import { invalidateMenuSnapshot } from '$lib/tenant/menuCache.svelte';
	import { invalidateStorefrontAdmin } from '$lib/storefront/adminCache.svelte';
	import { clearBrandTheme, invalidateBrandThemeCache } from '$lib/brandTheme';
	import { activateUpdate, onUpdateAvailable } from '$lib/pwa.svelte';
	import AdminShellSkeleton from '$lib/components/admin/AdminShellSkeleton.svelte';
	import Toaster from '$lib/components/admin/Toaster.svelte';
	import { toast } from '$lib/components/admin/toast';
	import AppShell from '$lib/components/shell/AppShell.svelte';

	let { children, data } = $props();

	type StoreLink = {
		slug: string;
		public_url?: string;
		public_host?: string;
		public_path?: string;
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
	/** Bumps on each auth attempt so stale me() results cannot flip shell status. */
	let authGen = 0;

	/**
	 * `/shop/login` is a child of this layout. It must always render its own UI —
	 * never the shell skeleton and never the empty "anon" frame. Super Admin does
	 * the same for `/superadmin/login`; an earlier shop-only "decide once" gate
	 * left `status === 'anon'` painting a blank 100dvh div forever (black page
	 * after logout) and blocked the login form from mounting.
	 */
	const isPublicRoute = $derived($page.url.pathname === '/shop/login');

	/**
	 * Which side of the login wall the current `status` describes. Crossing
	 * public ↔ protected must re-resolve identity; staying on one side must not
	 * re-run `me()` on every navigation (that was the permanent loading loop).
	 */
	let resolvedSide = $state<'public' | 'protected' | null>(null);

	const isAdmin = $derived(user?.role === 'TENANT_ADMIN');

	/**
	 * Tenant Admin sees the full IA. Staff only get RUNNING ops — Selling and
	 * Kitchen — until fine-grained IAM exists.
	 */
	const navGroups = $derived(
		TENANT_NAV.map((group) => ({
			...group,
			items: group.items.filter((item) => {
				if (isAdmin) return true;
				return group.label === 'Running' && STAFF_OPS_HREFS.has(item.href);
			})
		})).filter((group) => group.items.length > 0)
	);

	const quickLinks = $derived([
		{ href: '/shop/orders', label: 'Selling', icon: ClipboardList },
		{ href: '/shop/kitchen', label: 'Kitchen', icon: ChefHat }
	]);

	const isFullscreen = $derived(
		isOpsFullscreenPath($page.url.pathname) && $page.url.searchParams.get('fullscreen') === '1'
	);

	/** Resolve identity for the side of the login wall we are currently on. */
	async function resolve(side: 'public' | 'protected') {
		if (side === 'public') {
			// Login renders its own screen — no shell, no identity fetch.
			status = 'ready';
			return;
		}

		status = 'loading';
		const gen = ++authGen;

		if (!getAccessToken()) {
			if (gen !== authGen) return;
			status = 'anon';
			goto('/shop/login', { replaceState: true });
			return;
		}

		try {
			const me_ = await me();
			if (gen !== authGen) return;
			if (me_.role !== 'TENANT_ADMIN' && me_.role !== 'STAFF') {
				status = 'anon';
				goto('/shop/login', { replaceState: true });
				return;
			}
			user = me_;
			status = 'ready';
		} catch {
			if (gen !== authGen) return;
			status = 'anon';
			goto('/shop/login', { replaceState: true });
		}
	}

	$effect(() => {
		const side = isPublicRoute ? 'public' : 'protected';
		if (resolvedSide === side) return;
		resolvedSide = side;
		void resolve(side);
	});

	// Shop identity drives the rail header and the storefront link.
	$effect(() => {
		if (status !== 'ready' || !user || isPublicRoute) return;
		let cancelled = false;
		(async () => {
			try {
				const link = await api<StoreLink>('/api/v1/tenant/store-link');
				if (cancelled) return;
				shopName = link.name || data.tenantSlug || 'Your shop';
				storefrontUrl =
					link.public_url ||
					(link.public_host ? `http://${link.public_host}${link.public_path || ''}` : '');
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

	// Slow badge poll only — ops pages acquire('ops') for the fast cadence.
	$effect(() => {
		if (status !== 'ready' || !user || isPublicRoute) return;
		orderBoard.acquire('badge');
		return () => orderBoard.release('badge');
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
		await logout();
		// Discard an in-flight identity check. Without this a `me()` that was
		// already on the wire resolves after sign-out and sets the shell back to
		// 'ready', putting a signed-out user back in the console.
		authGen++;
		user = null;
		status = 'anon';
		shopName = '';
		storefrontUrl = '';
		// Drop session-scoped caches so the next sign-in never paints another
		// tenant's dashboard/menu for a frame.
		invalidateDashboardSnapshot();
		invalidateMenuSnapshot();
		invalidateStorefrontAdmin();
		invalidateBrandThemeCache();
		clearBrandTheme();
		// Force a fresh resolve when signing back in (public → protected).
		resolvedSide = null;
		goto('/shop/login', { replaceState: true });
	}
</script>

{#if isPublicRoute}
	{@render children()}
	<Toaster />
{:else if status === 'ready' && user}
	{#if isFullscreen}
		{@render children()}
		<Toaster />
	{:else}
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
			{quickLinks}
			storageKey="orderly-shop-rail"
			settingsHref="/shop/settings"
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
	{/if}
{:else if status === 'loading'}
	<!-- Shell-shaped so the frame doesn't jump when identity resolves. -->
	<AdminShellSkeleton />
{:else}
	<!-- Unauthenticated on a protected route: hold while redirect to login lands. -->
	<div style="min-height:100dvh;"></div>
{/if}
