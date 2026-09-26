<script lang="ts">
	import { onMount } from 'svelte';
	import { applyTheme, resolveInitialTheme, toggleTheme, type ThemeMode } from '$lib/theme';

	let mode = $state<ThemeMode>('light');

	onMount(() => {
		mode = resolveInitialTheme();
		applyTheme(mode);
	});

	function onToggle() {
		mode = toggleTheme(mode);
	}
</script>

<button
	type="button"
	class="btn btn-ghost theme-toggle"
	aria-label={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
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

<style>
	.theme-toggle {
		padding: 0.4rem 0.55rem;
		min-width: 2.25rem;
	}
</style>
