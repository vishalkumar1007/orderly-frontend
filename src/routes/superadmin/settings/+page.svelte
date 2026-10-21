<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import SettingsShell from '$lib/components/admin/SettingsShell.svelte';
	import {
		ADMIN_SETTINGS_GROUPS,
		adminSettingsSectionFor,
		visibleAdminSettingsSections
	} from '$lib/admin/settings';
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
	 * back button works, and a reload stays where you were. The list itself is
	 * a pure module (`lib/admin/settings.ts`) so `check:nav` can exercise it,
	 * exactly as the business console does.
	 */

	let user = $state<User | null>(null);

	onMount(async () => {
		try {
			user = await me();
		} catch {
			// The shell already guards this route; without permissions we simply
			// fall back to showing everything the API will answer for anyway.
		}
	});

	const visible = $derived(visibleAdminSettingsSections(user?.permissions));

	const groups = $derived(
		ADMIN_SETTINGS_GROUPS.map((label) => ({
			label,
			items: visible.filter((s) => s.group === label)
		})).filter((group) => group.items.length > 0)
	);

	/** Only an operator who may write platform settings can move the default. */
	const canWritePlatformSettings = $derived(
		(user?.permissions ?? []).includes('platform_settings') ||
			(user?.permissions ?? []).length === 0
	);

	const active = $derived(
		adminSettingsSectionFor($page.url.searchParams.get('section'), user?.permissions)
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
