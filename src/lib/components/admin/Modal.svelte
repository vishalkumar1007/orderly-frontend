<script lang="ts">
	import type { Snippet } from 'svelte';
	import X from '@lucide/svelte/icons/x';

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
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div class="overlay" role="presentation" onkeydown={(e) => e.key === 'Escape' && close()} onclick={close}>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_interactive_supports_focus -->
		<div
			class="modal"
			role="dialog"
			aria-modal="true"
			aria-label={title}
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
		>
			<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.75rem;margin-bottom:0.85rem;">
				<h3>{title}</h3>
				<button type="button" class="btn btn-quiet btn-sm" aria-label="Close" onclick={close}>
					<X size={16} strokeWidth={2} />
				</button>
			</div>
			{@render children()}
			{#if footer}
				<div class="modal-actions" style="margin-top:1.15rem;">{@render footer()}</div>
			{/if}
		</div>
	</div>
{/if}
