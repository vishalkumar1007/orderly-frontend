<script lang="ts">
	import { consoleAppearance, setColorMode } from '$lib/appearance.svelte';
	import { resolveInitialTheme, type ThemeMode } from '$lib/theme';

	/**
	 * Light / dark.
	 *
	 * This used to write `data-theme` and a `localStorage` key of its own, which
	 * made it a second theme system: it disagreed with the colour mode saved on
	 * the account the moment either changed, and which one you saw depended on
	 * whether you had reloaded. It now sets the signed-in person's own
	 * `color_mode`, so the toggle, the Appearance screen and the next sign-in
	 * are the same setting.
	 *
	 * Signed out — the storefront, a sign-in page — there is no account to write
	 * to, and `setColorMode` falls back to flipping the attribute for the
	 * session.
	 */
	let busy = $state(false);

	/** The appearance is authoritative once loaded; before that, the cache is. */
	const mode = $derived<ThemeMode>(
		consoleAppearance.appearance ? consoleAppearance.mode : resolveInitialTheme()
	);

	async function onToggle() {
		if (busy) return;
		busy = true;
		try {
			await setColorMode(mode === 'light' ? 'dark' : 'light');
		} finally {
			busy = false;
		}
	}
</script>

<button
	type="button"
	class="btn btn-ghost theme-toggle"
	aria-label={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
	aria-pressed={mode === 'dark'}
	title={mode === 'light' ? 'Dark mode' : 'Light mode'}
	onclick={onToggle}
>
	{#if mode === 'light'}
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
