<script lang="ts">
	import { consoleAppearance, isDarkFamily, toggleColorMode } from '$lib/appearance.svelte';
	import { resolveInitialTheme, type ThemeMode } from '$lib/theme';

	/**
	 * Light / dark family toggle.
	 *
	 * Preserves Soft↔Night when those are selected in Appearance; otherwise
	 * flips classic Light↔Dark. Writes the signed-in person's `color_mode`.
	 */
	let busy = $state(false);

	/** The appearance is authoritative once loaded; before that, the cache is. */
	const mode = $derived<ThemeMode>(
		consoleAppearance.appearance ? consoleAppearance.mode : resolveInitialTheme()
	);
	const dark = $derived(isDarkFamily(mode));

	async function onToggle() {
		if (busy) return;
		busy = true;
		try {
			await toggleColorMode();
		} finally {
			busy = false;
		}
	}
</script>

<button
	type="button"
	class="btn btn-ghost theme-toggle"
	aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
	aria-pressed={dark}
	title={dark ? 'Light mode' : 'Dark mode'}
	onclick={onToggle}
>
	{#if !dark}
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path
				d="M12 3v2m0 14v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M3 12h2m14 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"
			/>
			<circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8" />
		</svg>
	{:else}
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path
				d="M21 14.5A7.5 7.5 0 0 1 9.5 3 6.5 6.5 0 1 0 21 14.5Z"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linejoin="round"
			/>
		</svg>
	{/if}
</button>
