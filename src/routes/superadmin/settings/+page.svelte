<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import Building2 from '@tabler/icons-svelte/icons/building';
	import Globe from '@tabler/icons-svelte/icons/world';
	import Shapes from '@tabler/icons-svelte/icons/category';
	import ShieldCheck from '@tabler/icons-svelte/icons/shield-check';
	import UserRound from '@tabler/icons-svelte/icons/user';
	import Palette from '@tabler/icons-svelte/icons/palette';
	import SettingsShell from '$lib/components/admin/SettingsShell.svelte';
	import { me, type User } from '$lib/auth';
	import AppearancePanel from '$lib/components/tenant/settings/AppearancePanel.svelte';
	import BusinessTypesPanel from '$lib/components/admin/settings/BusinessTypesPanel.svelte';
	import GeneralPanel from '$lib/components/admin/settings/GeneralPanel.svelte';
	import ProfilePanel from '$lib/components/admin/settings/ProfilePanel.svelte';
	import SecurityPanel from '$lib/components/admin/settings/SecurityPanel.svelte';
	import TenantAccessTable from '$lib/components/admin/TenantAccessTable.svelte';

	/**
	 * Settings.
	 *
	 * One destination with a section rail inside it, rather than five entries in
	 * the navigation. Settings are a place you go to change one thing and leave;
	 * spreading them across the main rail made the console's top-level
	 * navigation mostly about configuration, which is not what an operator
	 * spends their day on.
	 *
	 * The tab lives in the query string so a link can point at a section, the
	 * back button works, and a reload stays where you were.
	 */

	type Section = {
		id: string;
		label: string;
		icon: typeof Building2;
		group: 'Platform' | 'Your account';
		/** Capability the API requires. Sections you cannot use are not shown. */
		requires?: string;
		lede: string;
	};

	const SECTIONS: Section[] = [
		{
			id: 'general',
			label: 'General',
			icon: Building2,
			group: 'Platform',
			requires: 'platform_settings',
			lede: 'How the platform identifies itself, and the defaults every new business starts from.'
		},
		{
			id: 'business-types',
			label: 'Business types',
			icon: Shapes,
			group: 'Platform',
			requires: 'platform_settings',
			lede: 'What a business can be. The type chosen at onboarding sets its theme, layout, terminology and order workflow.'
		},
		{
			id: 'security',
			label: 'Security',
			icon: ShieldCheck,
			group: 'Platform',
			requires: 'platform_settings',
			lede: 'Password rules, session lifetime and invite expiry, applied across every business.'
		},
		{
			id: 'tenant-access',
			label: 'Business access',
			icon: Globe,
			group: 'Platform',
			requires: 'platform_settings',
			lede: 'Which businesses may use the platform’s shared providers, on top of each provider’s own on/off switch. Credentials themselves live under Providers & integrations.'
		},
		{
			id: 'profile',
			label: 'Profile',
			icon: UserRound,
			group: 'Your account',
			lede: 'Your own account and password.'
		},
		{
			id: 'appearance',
			label: 'Appearance',
			icon: Palette,
			group: 'Your account',
			lede: 'How this console looks to you. Your choice follows your account and changes nothing for anyone else who signs in here: and, if you may change platform settings, what everyone starts from.'
		}
	];

	let user = $state<User | null>(null);

	onMount(async () => {
		try {
			user = await me();
		} catch {
			// The shell already guards this route; without permissions we simply
			// fall back to showing everything the API will answer for anyway.
		}
	});

	/** Sections this account may actually use. */
	const visible = $derived(
		SECTIONS.filter((section) => {
			if (!section.requires) return true;
			const held = user?.permissions;
			if (!held || held.length === 0) return true;
			return held.includes(section.requires);
		})
	);

	const groups = $derived(
		(['Platform', 'Your account'] as const)
			.map((label) => ({ label, items: visible.filter((s) => s.group === label) }))
			.filter((group) => group.items.length > 0)
	);

	/** Only an operator who may write platform settings can move the default. */
	const canWritePlatformSettings = $derived(
		(user?.permissions ?? []).includes('platform_settings') ||
			(user?.permissions ?? []).length === 0
	);

	const requested = $derived($page.url.searchParams.get('section') ?? 'general');
	const active = $derived(
		visible.find((s) => s.id === requested) ?? visible[0] ?? SECTIONS[0]
	);

	function select(id: string) {
		goto(`?section=${id}`, { replaceState: true, keepFocus: true, noScroll: true });
	}
</script>

<SettingsShell
	{groups}
	activeId={active.id}
	title={active.label}
	lede={active.lede}
	onselect={select}
>
	{#if active.id === 'general'}
		<GeneralPanel />
	{:else if active.id === 'business-types'}
		<BusinessTypesPanel />
	{:else if active.id === 'security'}
		<SecurityPanel />
	{:else if active.id === 'appearance'}
		<AppearancePanel kind="platform" canSetBusinessDefault={canWritePlatformSettings} />
	{:else if active.id === 'tenant-access'}
		<TenantAccessTable />
	{:else}
		<ProfilePanel />
	{/if}
</SettingsShell>
