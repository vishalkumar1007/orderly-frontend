<script lang="ts">
	import type { Snippet } from 'svelte';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import type { Crumb } from '$lib/admin/routeMeta';
	import ThemeToggle from './ThemeToggle.svelte';

	let {
		crumbs = [] as Crumb[],
		title = 'Dashboard',
		actions
	}: {
		crumbs?: Crumb[];
		title?: string;
		actions?: Snippet;
	} = $props();
</script>

<header class="topbar">
	<div class="topbar-left">
		{#if crumbs.length > 0}
			<nav class="crumbs" aria-label="Breadcrumb">
				{#each crumbs as crumb, i (crumb.href ?? `${crumb.label}-${i}`)}
					{#if i > 0}
						<ChevronRight size={12} strokeWidth={2} class="crumb-sep" aria-hidden="true" />
					{/if}
					{#if crumb.href}
						<a class="crumb-link" href={crumb.href}>{crumb.label}</a>
					{:else}
						<span class="crumb-current" aria-current="page">{crumb.label}</span>
					{/if}
				{/each}
			</nav>
		{/if}
		<h2 class="topbar-title">{title}</h2>
	</div>

	<div class="topbar-actions">
		<ThemeToggle />
		{#if actions}
			<span class="topbar-sep" aria-hidden="true"></span>
			{@render actions()}
		{/if}
	</div>
</header>
