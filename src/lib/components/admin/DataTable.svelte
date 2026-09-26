<script lang="ts">
	import type { Snippet } from 'svelte';
	import EmptyState from './EmptyState.svelte';
	import Skeleton from './Skeleton.svelte';

	let {
		loading = false,
		empty = false,
		emptyTitle = 'No results',
		emptyDescription = 'Try adjusting filters or create a new item.',
		children,
		head
	}: {
		loading?: boolean;
		empty?: boolean;
		emptyTitle?: string;
		emptyDescription?: string;
		head: Snippet;
		children: Snippet;
	} = $props();
</script>

{#if loading}
	<div style="padding:1.25rem;display:flex;flex-direction:column;gap:0.75rem;">
		{#each [1, 2, 3, 4, 5] as _, i (i)}
			<Skeleton height="2.1rem" />
		{/each}
	</div>
{:else if empty}
	<EmptyState title={emptyTitle} description={emptyDescription} />
{:else}
	<div class="table-wrap">
		<table class="table">
			<thead><tr>{@render head()}</tr></thead>
			<tbody>{@render children()}</tbody>
		</table>
	</div>
{/if}
