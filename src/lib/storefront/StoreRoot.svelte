<script lang="ts">
	import type { StoreConfig } from '$lib/storefront/api';

	/**
	 * The storefront root.
	 *
	 * Two jobs, both of which have to happen before the first paint:
	 *
	 * 1. Write the server-resolved design tokens onto this element as an inline
	 *    style, so the very first frame is already the tenant's colours. Svelte
	 *    renders this during SSR, which is what removes the flash of a default
	 *    theme.
	 * 2. Resolve `system` theme mode to a concrete one. The tokens themselves are
	 *    mode-independent; only the neutral surfaces change, and those are keyed
	 *    off `data-sf-theme` in the stylesheet.
	 */
	import { hasCompleteTokens, resolveThemeMode, themeVars, FALLBACK_THEME } from './theme';
	import { onMount } from 'svelte';

	let {
		config,
		tenantSlug = '',
		children
	}: {
		config: StoreConfig | null;
		/**
		 * The slug the server resolved from the hostname. Rendered onto the element
		 * so the rendered page says which shop it is.
		 *
		 * This is not decoration. A storefront with no tenant behind it and a
		 * storefront for a real shop render almost identically, and
		 * `scripts/check_storefront_routes.sh` needs to tell them apart — a route
		 * check that passes while serving the empty state is worse than no check,
		 * because it looks like coverage.
		 */
		tenantSlug?: string;
		children: import('svelte').Snippet;
	} = $props();

	const theme = $derived(config?.theme ?? FALLBACK_THEME);
	const vars = $derived(hasCompleteTokens(theme) ? themeVars(theme) : themeVars(FALLBACK_THEME));
	const mode = $derived(resolveThemeMode(theme.mode));

	// `system` needs the OS preference, which only exists in the browser. A
	// listener keeps a storefront that is left open across a theme switch
	// correct without a reload.
	let systemDark = $state(false);

	onMount(() => {
		const query = window.matchMedia('(prefers-color-scheme: dark)');
		systemDark = query.matches;
		const onChange = (event: MediaQueryListEvent) => (systemDark = event.matches);
		query.addEventListener('change', onChange);
		return () => query.removeEventListener('change', onChange);
	});

	const resolved = $derived(theme.mode === 'system' ? (systemDark ? 'dark' : 'light') : mode);
</script>

<div class="sf-root" data-sf-theme={resolved} data-sf-tenant={tenantSlug || undefined} style={vars}>
	{@render children()}
</div>
