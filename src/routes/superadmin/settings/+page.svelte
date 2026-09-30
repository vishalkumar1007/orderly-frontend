<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { Component } from 'svelte';
	import Building2 from '@lucide/svelte/icons/building-2';
	import Shapes from '@lucide/svelte/icons/shapes';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import UserRound from '@lucide/svelte/icons/user-round';
	import Palette from '@lucide/svelte/icons/palette';
	import { me, type User } from '$lib/auth';
	import AppearancePanel from '$lib/components/tenant/settings/AppearancePanel.svelte';
	import BusinessTypesPanel from '$lib/components/admin/settings/BusinessTypesPanel.svelte';
	import GeneralPanel from '$lib/components/admin/settings/GeneralPanel.svelte';
	import ProfilePanel from '$lib/components/admin/settings/ProfilePanel.svelte';
	import SecurityPanel from '$lib/components/admin/settings/SecurityPanel.svelte';

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
		icon: Component;
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
			lede: 'How this console looks to you. Your choice follows your account and changes nothing for anyone else who signs in here — and, if you may change platform settings, what everyone starts from.'
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

<div class="set-shell">
	<nav class="set-rail" aria-label="Settings sections">
		{#each groups as group (group.label)}
			<p class="set-rail-label">{group.label}</p>
			{#each group.items as section (section.id)}
				<button
					type="button"
					class={['set-rail-link', active.id === section.id ? 'active' : ''].join(' ')}
					aria-current={active.id === section.id ? 'page' : undefined}
					onclick={() => select(section.id)}
				>
					<section.icon size={15} strokeWidth={1.9} />
					{section.label}
				</button>
			{/each}
		{/each}
	</nav>

	<div class="set-main">
		<header class="set-page-head">
			<h1 class="set-page-title">{active.label}</h1>
			<p class="set-lede">{active.lede}</p>
		</header>

		{#if active.id === 'general'}
			<GeneralPanel />
		{:else if active.id === 'business-types'}
			<BusinessTypesPanel />
		{:else if active.id === 'security'}
			<SecurityPanel />
		{:else if active.id === 'appearance'}
			<AppearancePanel kind="platform" canSetBusinessDefault={canWritePlatformSettings} />
		{:else}
			<ProfilePanel />
		{/if}
	</div>
</div>

<style>
	.set-shell {
		display: grid;
		gap: 1.75rem;
		align-items: start;
	}

	@media (min-width: 1000px) {
		.set-shell {
			grid-template-columns: 12.5rem minmax(0, 1fr);
			gap: 2rem;
		}
	}

	.set-rail {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.35rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
	}

	@media (min-width: 1000px) {
		.set-rail {
			position: sticky;
			top: calc(var(--topbar-h) + 1rem);
		}
	}

	@media (max-width: 999px) {
		/* A column of section links above a form reads as part of the form on a
		   phone, so it becomes a scrolling row instead. */
		.set-rail {
			flex-direction: row;
			overflow-x: auto;
			padding: 0.35rem;
			gap: 0.25rem;
		}

		.set-rail-label {
			display: none;
		}
	}

	.set-rail-label {
		margin: 0.65rem 0 0.2rem;
		padding: 0 0.55rem;
		font-size: var(--fs-micro);
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-3);
	}

	.set-rail-label:first-child {
		margin-top: 0.15rem;
	}

	.set-rail-link {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.45rem 0.55rem;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-2);
		font-family: inherit;
		font-size: var(--fs-body);
		font-weight: 500;
		text-align: left;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background var(--tr),
			color var(--tr);
	}

	.set-rail-link:hover {
		background: var(--surface-2);
		color: var(--text);
	}

	.set-rail-link.active {
		background: var(--accent-soft);
		color: var(--accent-dark);
		font-weight: 600;
	}

	.set-main {
		min-width: 0;
	}

	.set-page-head {
		margin-bottom: 0.35rem;
		padding-bottom: 1.15rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.set-page-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-h1);
		font-weight: 650;
		letter-spacing: -0.025em;
		color: var(--text);
		line-height: 1.2;
	}

	.set-lede {
		margin: 0.4rem 0 0;
		font-size: var(--fs-body);
		line-height: 1.55;
		color: var(--text-3);
		max-width: 42rem;
	}
</style>
