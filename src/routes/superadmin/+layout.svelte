<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import IconPlus from '@tabler/icons-svelte/icons/plus';
	import { getAccessToken } from '$lib/api/client';
	import { logout, me, type User } from '$lib/auth';
	import { fetchSettings, fetchTenants } from '$lib/admin/api';
	import {
		SUPERADMIN_NAV,
		adminCrumbs,
		isBusinessSection,
		isOnboardingPage,
		type AdminCrumb
	} from '$lib/admin/nav';
	import AdminShellSkeleton from '$lib/components/admin/AdminShellSkeleton.svelte';
	import Toaster from '$lib/components/admin/Toaster.svelte';
	import AppShell from '$lib/components/shell/AppShell.svelte';

	let { children } = $props();

	type BusinessHit = { id: string; name: string };

	/**
	 * Tri-state: the shell never renders until the role is known, so nav items
	 * cannot appear and then vanish when identity resolves.
	 */
	type Status = 'loading' | 'authenticated' | 'unauthenticated';

	let status = $state<Status>('loading');
	let user = $state<User | null>(null);
	let platformName = $state('Orderly');
	let businesses = $state<BusinessHit[]>([]);

	const isPublicRoute = $derived(
		$page.url.pathname === '/superadmin/login' || $page.url.pathname === '/superadmin/setup'
	);

	/**
	 * Which side of the login wall the current `status` describes. This layout
	 * is reused across client-side navigations within /superadmin/*, so it must
	 * not resolve identity only once in onMount — that left `user` null after an
	 * in-app login and rendered the blank branch. Tracking the side lets us
	 * re-resolve on the login <-> app crossing while holding the resolved user
	 * across ordinary navigation, so the shell never flashes back to a skeleton.
	 */
	let resolvedSide = $state<'public' | 'protected' | null>(null);

	const tab = $derived($page.url.searchParams.get('tab'));
	const navContext = $derived({ businesses, tab });
	const crumbs = $derived<AdminCrumb[]>(adminCrumbs($page.url.pathname, navContext));
	/** Super Admin dashboards use the full shell width — no centered content cap. */
	const contentWide = true;
	/** Onboarding belongs to the Businesses section, and not to its own page. */
	const showOnboardAction = $derived(
		isBusinessSection($page.url.pathname) && !isOnboardingPage($page.url.pathname)
	);

	onMount(() => {
		// The rail's brand name and the trail's id → name lookup both need
		// platform data, so the shell loads it once and feeds it down rather
		// than every page fetching its own copy.
		fetchSettings()
			.then((s) => {
				if (s.general.platform_name?.trim()) platformName = s.general.platform_name.trim();
			})
			.catch(() => {
				/* the rail falls back to "Orderly" — not worth an error state */
			});
		fetchTenants()
			.then((rows) => {
				businesses = rows.map((t) => ({ id: t.id, name: t.name }));
			})
			.catch(() => {
				/* the trail falls back to showing the id */
			});
	});

	/** Resolve identity for the side of the login wall we are currently on. */
	async function resolve(side: 'public' | 'protected') {
		if (side === 'public') {
			// Login and setup render their own screens: no shell, no identity.
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
		title=""
		navLabel="Super Admin"
		groups={SUPERADMIN_NAV}
		wideContent={contentWide}
		storageKey="orderly-sidebar"
		settingsHref="/superadmin/settings"
		profileHref="/superadmin/settings?section=profile"
		onSignOut={signOut}
	>
		{#snippet actions()}
			{#if showOnboardAction}
				<a class="btn btn-primary btn-sm" href="/superadmin/businesses/new">
					<IconPlus size={15} stroke={1.8} />
					<span>Onboard business</span>
				</a>
			{/if}
		{/snippet}

		{@render children()}
	</AppShell>
	<Toaster />
{:else if status === 'loading'}
	<!-- Shell-shaped so the frame does not jump when identity resolves. -->
	<AdminShellSkeleton />
{:else}
	<!-- Unauthenticated: render nothing while the redirect lands. -->
	<div style="min-height:100vh;"></div>
{/if}
