<script lang="ts">
	import { onMount, type Component, type Snippet } from 'svelte';
	import type { Crumb } from '$lib/admin/routeMeta';
	import Menu from '@lucide/svelte/icons/menu';
	import SidebarNavLink from '$lib/components/admin/SidebarNavLink.svelte';
	import AdminTopbar from '$lib/components/admin/AdminTopbar.svelte';
	import SidebarHeader from '$lib/components/admin/SidebarHeader.svelte';
	import AdminProfileMenu from '$lib/components/admin/AdminProfileMenu.svelte';

	export type ShellNavItem = {
		href: string;
		label: string;
		icon: Component;
		/** Only show to these roles. */
		roles?: string[];
		/** Match only this exact path, not its children. */
		exact?: boolean;
		/** Child paths that belong to a sibling entry. */
		exclude?: string[];
	};
	export type ShellNavGroup = { label?: string; items: ShellNavItem[] };

	/** At or below this the rail becomes an overlay drawer instead of a column. */
	const DRAWER_BREAKPOINT = 900;
	/** Below this width the rail starts collapsed (icon-only). */
	const WIDE_BREAKPOINT = 1280;

	let {
		/** Shown in the rail header. Each portal passes its own identity. */
		brandName = 'Orderly',
		userEmail = '',
		userName = '',
		role = 'SUPER_ADMIN',
		pathname = '',
		groups = [] as ShellNavGroup[],
		/** Topbar title, e.g. "Dashboard". */
		title = '',
		/** Navigable trail shown in the topbar. */
		crumbs = [] as Crumb[],
		/** Accessible name for the rail landmark. */
		navLabel = 'Main',
		/** localStorage key for the collapsed choice, so portals don't share it. */
		storageKey = 'orderly-sidebar',
		/** Render content edge-to-edge, for wide forms. */
		wideContent = false,
		/** Hide the account menu, for embedded or kiosk surfaces. */
		showProfile = true,
		/** Settings link in the account menu — portal-specific. */
		settingsHref = '/superadmin/settings',
		onSignOut,
		/** Buttons rendered at the right of the topbar. */
		actions,
		children
	}: {
		brandName?: string;
		userEmail?: string;
		userName?: string;
		role?: string;
		pathname?: string;
		groups?: ShellNavGroup[];
		title?: string;
		crumbs?: Crumb[];
		navLabel?: string;
		storageKey?: string;
		wideContent?: boolean;
		showProfile?: boolean;
		settingsHref?: string;
		onSignOut?: () => void;
		actions?: Snippet;
		children: Snippet;
	} = $props();

	let mobileOpen = $state(false);
	let collapsed = $state(false);
	let isDrawer = $state(false);
	/** The drawer always shows labels — there is no room to collapse it. */
	const railCompact = $derived(collapsed && !isDrawer);

	$effect(() => {
		// Close the drawer whenever the route changes.
		pathname;
		mobileOpen = false;
	});

	onMount(() => {
		const mq = window.matchMedia(`(max-width: ${DRAWER_BREAKPOINT}px)`);
		const sync = () => {
			isDrawer = mq.matches;
		};
		sync();
		mq.addEventListener('change', sync);

		// Respect an explicit saved choice; otherwise pick a sensible default.
		const saved = localStorage.getItem(storageKey);
		collapsed = saved === 'collapsed' || (saved !== 'expanded' && window.innerWidth < WIDE_BREAKPOINT);

		return () => mq.removeEventListener('change', sync);
	});

	$effect(() => {
		if (!mobileOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') mobileOpen = false;
		};
		document.addEventListener('keydown', onKey);
		// Prevent the page behind the drawer from scrolling.
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.removeEventListener('keydown', onKey);
			document.body.style.overflow = prev;
		};
	});

	function toggleCollapse() {
		collapsed = !collapsed;
		try {
			localStorage.setItem(storageKey, collapsed ? 'collapsed' : 'expanded');
		} catch {
			/* private mode — the choice just won't persist */
		}
	}

	function closeDrawer() {
		mobileOpen = false;
	}
</script>

<div class={['shell', railCompact ? 'rail-collapsed' : ''].join(' ')}>
	{#if mobileOpen}
		<button
			type="button"
			class="rail-overlay"
			aria-label="Close menu"
			onclick={closeDrawer}
		></button>
	{/if}

	<aside class={['rail', mobileOpen ? 'open' : ''].join(' ')}>
		<SidebarHeader
			{brandName}
			collapsed={railCompact}
			collapsible={!isDrawer}
			onToggle={toggleCollapse}
			onClose={closeDrawer}
		/>

		<nav class="rail-nav" aria-label={navLabel}>
			{#each groups as group, gi (group.label ?? gi)}
				<div class="rail-group">
					{#if group.label && !railCompact}
						<div class="rail-group-label">{group.label}</div>
					{/if}
					{#each group.items as item (item.href)}
						<SidebarNavLink
							href={item.href}
							label={item.label}
							icon={item.icon}
							{pathname}
							collapsed={railCompact}
							exact={item.exact ?? false}
							exclude={item.exclude ?? []}
							onclick={closeDrawer}
						/>
					{/each}
				</div>
			{/each}
		</nav>

		{#if showProfile}
			<div class="rail-foot">
				<AdminProfileMenu
					email={userEmail}
					displayName={userName || userEmail}
					{role}
					collapsed={railCompact}
					{settingsHref}
					onNavigate={closeDrawer}
					{onSignOut}
				/>
			</div>
		{/if}
	</aside>

	<div class="main">
		{#if isDrawer}
			<div class="rail-mobile-bar">
				<button
					type="button"
					class="mobile-burger"
					onclick={() => (mobileOpen = true)}
					aria-label="Open menu"
					aria-expanded={mobileOpen}
				>
					<Menu size={18} strokeWidth={1.75} />
				</button>
				<span class="rail-mobile-name">{brandName}</span>
			</div>
		{/if}

		<AdminTopbar {crumbs} {title}>
			{#snippet actions()}
				{#if actions}
					{@render actions()}
				{/if}
			{/snippet}
		</AdminTopbar>

		<div class={['content fade-in', wideContent ? 'content-wide' : ''].join(' ')}>
			{@render children()}
		</div>
	</div>
</div>
