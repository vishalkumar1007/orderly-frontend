<script lang="ts">
	import { page } from '$app/stores';
	import { MARKETING_SECTIONS } from '$lib/tenant/marketingApi';

	/** Section strip shared by every Marketing page. */
	const path = $derived($page.url.pathname.replace(/\/+$/, ''));
	function active(href: string): boolean {
		if (href === '/shop/marketing') {
			return path === href || path === '/shop/marketing/new' || /^\/shop\/marketing\/[0-9a-f-]{36}$/.test(path);
		}
		return path === href || path.startsWith(href + '/');
	}
</script>

<nav class="mk-tabs" aria-label="Marketing sections">
	{#each MARKETING_SECTIONS as s (s.href)}
		<a href={s.href} class={active(s.href) ? 'active' : ''} aria-current={active(s.href) ? 'page' : undefined}>{s.label}</a>
	{/each}
</nav>

<style>
	.mk-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		border-bottom: 1px solid var(--border, color-mix(in srgb, var(--text) 10%, transparent));
	}
	.mk-tabs a {
		padding: 0.5rem 0.75rem;
		margin-bottom: -1px;
		font-size: var(--fs-body);
		color: var(--text-2);
		text-decoration: none;
		border-bottom: 2px solid transparent;
	}
	.mk-tabs a:hover {
		color: var(--text);
	}
	.mk-tabs a.active {
		color: var(--text);
		font-weight: 600;
		border-bottom-color: var(--accent, #4f46e5);
	}
</style>
