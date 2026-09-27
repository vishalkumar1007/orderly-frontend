<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import type { Component } from 'svelte';
	import Activity from '@lucide/svelte/icons/activity';
	import Building2 from '@lucide/svelte/icons/building-2';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import Plus from '@lucide/svelte/icons/plus';
	import Settings from '@lucide/svelte/icons/settings';
	import Users from '@lucide/svelte/icons/users';
	import { getAccessToken } from '$lib/api/client';
	import { logout, me, type User } from '$lib/auth';
	import { fetchSettings, fetchTenants } from '$lib/admin/api';
	import {
		breadcrumbsFor,
		isTenantCreatePage,
		isTenantSection,
		metaForPath,
		type Crumb
	} from '$lib/admin/routeMeta';
	import AdminShellSkeleton from '$lib/components/admin/AdminShellSkeleton.svelte';
	import Toaster from '$lib/components/admin/Toaster.svelte';
	import AppShell, {
		type ShellNavGroup,
		type ShellNavItem
	} from '$lib/components/shell/AppShell.svelte';

	let { children } = $props();

	type NavItem = ShellNavItem;
	type NavGroup = ShellNavGroup;
	type TenantHit = { id: string; name: string; slug: string; owner_name?: string };

	/**
	 * Tri-state, mirroring Orbit: we never render the shell until the role is
	 * known, so nav items can't appear and then vanish on a permission change.
	 */
	type Status = 'loading' | 'authenticated' | 'unauthenticated';

	let status = $state<Status>('loading');
	let user = $state<User | null>(null);
	let platformName = $state('Orderly');
	let tenants = $state<TenantHit[]>([]);

	const isPublicRoute = $derived(
		$page.url.pathname === '/superadmin/login' || $page.url.pathname === '/superadmin/setup'
	);

	/**
	 * Which side of the login wall the current `status` describes. This layout is
	 * reused across client-side navigations within /superadmin/*, so it must not
	 * resolve identity only once in onMount — that left `user` null after an
	 * in-app login and rendered the blank branch. Tracking the side lets us
	 * re-resolve on the login <-> app crossing while still holding the resolved
	 * user across normal in-app navigation, so the shell never flashes back to
	 * the skeleton.
	 */
	let resolvedSide = $state<'public' | 'protected' | null>(null);

	const NAV: NavGroup[] = [
		{
			label: 'Overview',
			// Exact: the dashboard must not stay lit while browsing tenants.
			items: [{ href: '/superadmin', label: 'Dashboard', icon: LayoutDashboard, exact: true }]
		},
		{
			label: 'Tenants',
			items: [
				{
					href: '/superadmin/tenants',
					label: 'All tenants',
					icon: Building2,
					// The create form is its own destination.
					exclude: ['/superadmin/tenants/new']
				}
			]
		},
		{
			label: 'Platform',
			items: [
				{ href: '/superadmin/users', label: 'Users', icon: Users },
				{ href: '/superadmin/activity', label: 'Activity', icon: Activity }
			]
		},
		{
			label: 'System',
			items: [{ href: '/superadmin/settings', label: 'Settings', icon: Settings }]
		}
	];

	/** Drop nav entries the resolved role cannot open, and any group left empty. */
	const navGroups = $derived.by<ShellNavGroup[]>(() => {
		const role = user?.role;
		return NAV.map((group) => ({
			...group,
			items: group.items.filter((item) => !item.roles || (role ? item.roles.includes(role) : false))
		})).filter((group) => group.items.length > 0);
	});

	const routeMeta = $derived(metaForPath($page.url.pathname, tenants));
	const crumbs = $derived<Crumb[]>(breadcrumbsFor($page.url.pathname, $page.url.search, tenants));
	const contentWide = $derived(isTenantCreatePage($page.url.pathname));
	/** Onboarding actions belong to the Tenants section only. */
	const showTenantAction = $derived(
		isTenantSection($page.url.pathname) && !isTenantCreatePage($page.url.pathname)
	);

	onMount(() => {
		// The brand name and the breadcrumb's tenant lookup both need the
		// platform's own data, so they load here and feed the shell as props
		// rather than the shell fetching for itself.
		fetchSettings()
			.then((s) => {
				if (s.general.platform_name?.trim()) platformName = s.general.platform_name.trim();
			})
			.catch(() => {});
		fetchTenants()
			.then((rows) => {
				tenants = rows.map((t) => ({
					id: t.id,
					name: t.name,
					slug: t.slug,
					owner_name: t.owner_name
				}));
			})
			.catch(() => {});
	});

	/** Resolve identity for the side of the login wall we are currently on. */
	async function resolve(side: 'public' | 'protected') {
		if (side === 'public') {
			// Login/setup render their own screens, so no shell and no identity needed.
			status = 'authenticated';
			return;
		}
		status = 'loading';

		if (!getAccessToken()) {
			status = 'unauthenticated';
			goto('/superadmin/login', { replaceState: true });
			return;
		}
		try {
			const next = await me();
			if (next.role !== 'SUPER_ADMIN') {
				status = 'unauthenticated';
				goto('/superadmin/login', { replaceState: true });
				return;
			}
			user = next;
			status = 'authenticated';
		} catch {
			status = 'unauthenticated';
			goto('/superadmin/login', { replaceState: true });
		}
	}

	$effect(() => {
		const side = isPublicRoute ? 'public' : 'protected';
		if (resolvedSide === side) return;
		resolvedSide = side;
		void resolve(side);
	});

	async function signOut() {
		await logout();
		user = null;
		status = 'unauthenticated';
		// Force a fresh resolve when signing back in.
		resolvedSide = null;
		goto('/superadmin/login', { replaceState: true });
	}
</script>

{#if isPublicRoute}
	{@render children()}
	<Toaster />
{:else if status === 'authenticated' && user}
	<AppShell
		brandName={platformName}
		userEmail={user.email}
		userName={user.name}
		role={user.role}
		pathname={$page.url.pathname}
		{crumbs}
		title={routeMeta.title}
		navLabel="Super Admin"
		groups={navGroups}
		wideContent={contentWide}
		storageKey="orderly-sidebar"
		settingsHref="/superadmin/settings"
		onSignOut={signOut}
	>
		{#snippet actions()}
			{#if showTenantAction}
				<a class="btn btn-primary btn-sm" href="/superadmin/tenants/new">
					<Plus size={15} strokeWidth={2.2} />
					<span>New tenant</span>
				</a>
			{/if}
		{/snippet}

		{@render children()}
	</AppShell>
	<Toaster />
{:else if status === 'loading'}
	<!-- Shell-shaped so the frame doesn't jump when identity resolves. -->
	<AdminShellSkeleton />
{:else}
	<!-- Unauthenticated: render nothing while the redirect lands. -->
	<div style="min-height:100vh;"></div>
{/if}
