<script lang="ts">
	import type { Component } from 'svelte';

	let {
		href,
		label,
		icon: Icon,
		pathname = '',
		collapsed = false,
		/**
		 * Only match this exact path. A section root uses it so it stops lighting
		 * up for its own children, which have their own entries.
		 */
		exact = false,
		/**
		 * Paths under `href` that belong to a sibling entry and must not light
		 * this one up — e.g. the tenant list stays lit on a tenant's detail page
		 * but not on the create form.
		 */
		exclude = [] as string[],
		onclick
	}: {
		href: string;
		label: string;
		icon: Component;
		pathname?: string;
		collapsed?: boolean;
		exact?: boolean;
		exclude?: string[];
		onclick?: () => void;
	} = $props();

	const active = $derived.by(() => {
		if (exclude.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))) {
			return false;
		}
		if (pathname === href) return true;
		// Everything else is a child path, unless this link opted out.
		return !exact && pathname.startsWith(href + '/');
	});
</script>

<a
	{href}
	class="rail-link"
	class:active
	aria-current={active ? 'page' : undefined}
	aria-label={collapsed ? label : undefined}
	title={collapsed ? label : undefined}
	{onclick}
>
	<span class="rail-link-icon"><Icon size={14} strokeWidth={2} /></span>
	<span class="rail-link-label">{label}</span>
</a>
