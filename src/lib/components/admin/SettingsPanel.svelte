<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title = '',
		description = '',
		children,
		footer
	}: {
		title?: string;
		description?: string;
		children: Snippet;
		footer?: Snippet;
	} = $props();
</script>

<section class="settings-panel">
	{#if title || description}
		<div class="settings-panel-head">
			{#if title}<h2>{title}</h2>{/if}
			{#if description}<p>{description}</p>{/if}
		</div>
	{/if}
	<div class="settings-panel-body">{@render children()}</div>
	{#if footer}<div class="settings-panel-foot">{@render footer()}</div>{/if}
</section>
