<script lang="ts">
	import type { Snippet } from 'svelte';
	import X from '@tabler/icons-svelte/icons/x';

	let {
		open = $bindable(false),
		title = '',
		children,
		footer
	}: {
		open?: boolean;
		title?: string;
		children: Snippet;
		footer?: Snippet;
	} = $props();

	function close() {
		open = false;
	}
</script>

{#if open}
	<button type="button" class="slide-backdrop" aria-label="Close panel" onclick={close}></button>
	<div class="slide" role="dialog" aria-modal="true" aria-label={title} tabindex="-1">
		<header class="slide-head">
			<h3>{title}</h3>
			<button type="button" class="btn btn-quiet btn-sm" aria-label="Close" onclick={close}>
				<X size={16} stroke={1.6} />
			</button>
		</header>
		<div class="slide-body">{@render children()}</div>
		{#if footer}<footer class="slide-foot">{@render footer()}</footer>{/if}
	</div>
{/if}
