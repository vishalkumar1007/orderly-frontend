<script lang="ts">
	import { page } from '$app/stores';
	import Maximize2 from '@lucide/svelte/icons/maximize-2';
	import Minimize2 from '@lucide/svelte/icons/minimize-2';

	let { label = 'Fullscreen' }: { label?: string } = $props();

	const fullscreen = $derived($page.url.searchParams.get('fullscreen') === '1');

	function hrefFor(on: boolean): string {
		const url = new URL($page.url.href);
		if (on) url.searchParams.set('fullscreen', '1');
		else url.searchParams.delete('fullscreen');
		return url.pathname + url.search;
	}
</script>

<a
	class="btn btn-ghost btn-sm ops-fullscreen-toggle"
	href={hrefFor(!fullscreen)}
	aria-pressed={fullscreen}
>
	{#if fullscreen}
		<Minimize2 size={14} strokeWidth={2} />
		Exit {label}
	{:else}
		<Maximize2 size={14} strokeWidth={2} />
		{label}
	{/if}
</a>

<style>
	.ops-fullscreen-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		text-decoration: none;
	}
</style>
