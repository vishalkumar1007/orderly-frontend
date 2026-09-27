<script lang="ts">
	import type { Snippet } from 'svelte';
	import EmptyState from '$lib/components/admin/EmptyState.svelte';

	let {
		title,
		description,
		action
	}: {
		title: string;
		description: string;
		action?: Snippet;
	} = $props();
</script>

<div class="panel nav-placeholder">
	<EmptyState {title} {description} {action} />
</div>

<style>
	.nav-placeholder {
		max-width: 40rem;
	}
</style>
