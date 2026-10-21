<script lang="ts">
	import type { Snippet } from 'svelte';
	import ChevronRight from '@tabler/icons-svelte/icons/chevron-right';
	import type { AdminCrumb as Crumb } from '$lib/admin/nav';
	import NotificationBell from './NotificationBell.svelte';
	import SoundToggle from './SoundToggle.svelte';
	import ThemeToggle from './ThemeToggle.svelte';

	let {
		crumbs = [] as Crumb[],
		title = 'Dashboard',
		notificationScope,
		actions
	}: {
		crumbs?: Crumb[];
		title?: string;
		/** Which notification feed the bell polls. No bell when absent. */
		notificationScope?: 'tenant' | 'admin';
		actions?: Snippet;
	} = $props();
</script>

<header class="topbar">
	<div class="topbar-left">
		{#if crumbs.length > 0}
			<nav class="crumbs" aria-label="Breadcrumb">
				{#each crumbs as crumb, i (crumb.href ?? `${crumb.label}-${i}`)}
					{#if i > 0}
						<ChevronRight size={12} stroke={1.6} class="crumb-sep" aria-hidden="true" />
					{/if}
					{#if crumb.href}
						<a class="crumb-link" href={crumb.href}>{crumb.label}</a>
					{:else}
						<span class="crumb-current" aria-current="page">{crumb.label}</span>
					{/if}
				{/each}
			</nav>
		{:else if title?.trim()}
			<h2 class="topbar-title">{title}</h2>
		{/if}
	</div>

	<div class="topbar-actions">
		{#if actions}
			{@render actions()}
			<span class="topbar-sep" aria-hidden="true"></span>
		{/if}
		<!-- The personal controls sit together at the far right: sound, theme, notifications. -->
		<SoundToggle />
		<ThemeToggle />
		{#if notificationScope}
			<NotificationBell scope={notificationScope} />
		{/if}
	</div>
</header>
