<script lang="ts">
	import type { Snippet } from 'svelte';
	import Inbox from '@lucide/svelte/icons/inbox';

	let {
		title = 'Nothing here yet',
		description = '',
		action
	}: {
		title?: string;
		description?: string;
		action?: Snippet;
	} = $props();
</script>

<div class="empty">
	<span class="empty-icon"><Inbox size={20} strokeWidth={1.6} /></span>
	<h3>{title}</h3>
	{#if description}<p>{description}</p>{/if}
	{#if action}
		<div style="margin-top:0.5rem;display:flex;gap:0.5rem;">{@render action()}</div>
	{/if}
</div>
