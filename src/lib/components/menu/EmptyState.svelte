<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Inbox } from '@lucide/svelte/icons';
	import Tooltip from '$lib/components/menu/Tooltip.svelte';

	let {
		title = 'Nothing here yet',
		description = '',
		action,
		hint = ''
	}: {
		title?: string;
		description?: string;
		action?: Snippet;
		hint?: string;
	} = $props();
</script>

<div class="empty">
	<span class="empty-icon"><Inbox size={20} strokeWidth={1.6} /></span>
	<h3>{title}</h3>
	{#if description}<p>{description}</p>{/if}
	{#if hint}
		<p class="empty-hint">
			<Tooltip text={hint} />
		</p>
	{/if}
	{#if action}
		<div style="margin-top:0.5rem;display:flex;gap:0.5rem;">{@render action()}</div>
	{/if}
</div>

<style>
	.empty-hint {
		display: flex;
		justify-content: center;
		margin: 0.25rem 0 0;
	}
</style>
