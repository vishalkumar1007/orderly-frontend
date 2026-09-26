<script lang="ts">
	import type { Snippet } from 'svelte';
	import Skeleton from './Skeleton.svelte';

	let {
		label,
		value,
		hint = '',
		loading = false,
		icon
	}: {
		label: string;
		value: string | number;
		hint?: string;
		loading?: boolean;
		icon?: Snippet;
	} = $props();
</script>

<div class="stat">
	<div class="stat-top">
		{#if icon}<span class="stat-icon">{@render icon()}</span>{/if}
		<span class="stat-label">{label}</span>
	</div>
	{#if loading}
		<Skeleton height="1.5rem" width="4.5rem" />
	{:else}
		<p class="stat-value">{value}</p>
	{/if}
	{#if hint}<p class="stat-hint">{hint}</p>{/if}
</div>
