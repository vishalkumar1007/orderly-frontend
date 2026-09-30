<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import ChefHat from '@lucide/svelte/icons/chef-hat';
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import { getAccessToken } from '$lib/api/client';
	import { api } from '$lib/api/client';
	import { termsFor } from '$lib/admin/businessTypes';
	import { setBusinessType } from '$lib/tenant/businessType.svelte';
	import { logout, meWithTenant, type HostTenant, type User } from '$lib/auth';
	import {
		STAFF_OPS_HREFS,
		visibleGroups,
		TENANT_NAV,
		isOpsFullscreenPath,
		tenantCrumbs,
		tenantTitle
	} from '$lib/tenant/nav';
	import { orderBoard } from '$lib/tenant/orders.svelte';
	import { invalidateDashboardSnapshot, resolveStorefrontUrl } from '$lib/tenant/dashboardCache.svelte';
	import { invalidateMenuSnapshot } from '$lib/tenant/menuCache.svelte';
	import { invalidateStorefrontAdmin } from '$lib/storefront/adminCache.svelte';
	import { clearBrandTheme, invalidateBrandThemeCache } from '$lib/brandTheme';
	import { forgetAppearance } from '$lib/appearance.svelte';
	import { activateUpdate, onUpdateAvailable } from '$lib/pwa.svelte';
	import AdminShellSkeleton from '$lib/components/admin/AdminShellSkeleton.svelte';
	import Toaster from '$lib/components/admin/Toaster.svelte';
	import { toast } from '$lib/components/admin/toast';
	import AppShell from '$lib/components/shell/AppShell.svelte';
	import BusinessPolicyModal from '$lib/components/tenant/BusinessPolicyModal.svelte';
	import { policyStore } from '$lib/tenant/policyStore';

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
	let showPolicyModal = $state(false);

	$effect(() => {
		if (status === 'ready' && user && isAdmin && !isPublicRoute) {
			const slug = data.tenantSlug || hostTenant?.slug || '';
			if (slug && !policyStore.isSigned(slug) && !policyStore.isSkipped(slug)) {
				showPolicyModal = true;
			}
		}
	});

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
	let hostTenant = $state<HostTenant | null>(null);

	/** The roles that belong to a business. Platform roles are refused here. */
	const BUSINESS_ROLES = new Set(['TENANT_ADMIN', 'MANAGER', 'STAFF']);

	/**
	 * What kind of business this is. It decides the console's vocabulary and
	 * which operational screens exist, so it is resolved with the identity
	 * rather than fetched afterwards.
	 */
	const businessType = $derived(hostTenant?.business_type ?? '');

	const isAdmin = $derived(user?.role === 'TENANT_ADMIN');

	/**
	 * The rail shows exactly what this person's role may reach.
	 *
	 * The permission list arrives with the identity, so the rail and the API
	 * agree by construction: an owner sees everything, a manager sees the shop
	 * but not its configuration, and staff see the two running screens. A
	 * session issued before permissions existed falls back to the old
	 * role-based split rather than rendering an empty rail.
	 */
	const navGroups = $derived.by(() => {
		const permissions = user?.permissions;
		if (permissions && permissions.length > 0) {
			return visibleGroups(TENANT_NAV, permissions, user?.role, businessType);
		}
		return TENANT_NAV.map((group) => ({
			...group,
			items: group.items.filter((item) => {
				if (isAdmin) return true;
				return group.label === 'Running' && STAFF_OPS_HREFS.has(item.href);
			})
		})).filter((group) => group.items.length > 0);
	});

	const quickLinks = $derived([
		{ href: '/shop/orders', label: 'Selling', icon: ClipboardList },
		{ href: '/shop/kitchen', label: termsFor(businessType).station, icon: ChefHat }
	]);

	const isFullscreen = $derived(
		isOpsFullscreenPath($page.url.pathname) && $page.url.searchParams.get('fullscreen') === '1'
	);

	/** Storefront Studio owns the content pane edge-to-edge. */
	const isStudioHub = $derived($page.url.pathname === '/shop/customize');

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
			// One call for both: the rail's labels come from the business type,
			// so the shell must not render before it knows what kind of
			// business this is.
			const resolved = await meWithTenant();
			if (gen !== authGen) return;
			// Every business role, including manager. What each may reach is
			// decided by their permissions, not by this list.
			if (!BUSINESS_ROLES.has(resolved.user.role)) {
				status = 'anon';
				goto('/shop/login', { replaceState: true });
				return;
			}
			user = resolved.user;
			hostTenant = resolved.tenant;
			// Publish it before the first child renders, so no screen has to
			// paint generic wording and then correct itself.
			setBusinessType(resolved.tenant?.business_type);
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
				storefrontUrl = resolveStorefrontUrl(link);
			} catch {
				if (!cancelled) shopName = data.tenantSlug ?? 'Your shop';
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	const crumbs = $derived(tenantCrumbs($page.url.pathname, businessType));
	const title = $derived(tenantTitle($page.url.pathname, businessType));
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
		// The next person to sign in on this browser is not this person, so the
		// remembered theme must not outlive the session that chose it.
		forgetAppearance(data.tenantSlug ?? 'tenant');
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
			appearanceHref="/shop/settings?section=appearance"
			wideContent={isStudioHub}
			flushContent={isStudioHub}
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
		{#if user && isAdmin}
			<BusinessPolicyModal
				bind:open={showPolicyModal}
				tenantSlug={data.tenantSlug || hostTenant?.slug || ''}
				businessName={shopName || data.tenantSlug || ''}
				userName={user.name || ''}
				userEmail={user.email || ''}
				mandatory={true}
			/>
		{/if}
		<Toaster />
	{/if}
{:else if status === 'loading'}
	<!-- Shell-shaped so the frame doesn't jump when identity resolves. -->
	<AdminShellSkeleton />
{:else}
	<!-- Unauthenticated on a protected route: hold while redirect to login lands. -->
	<div style="min-height:100dvh;"></div>
{/if}
