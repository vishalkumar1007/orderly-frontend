<script lang="ts">
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';

	let {
		message,
		onretry
	}: {
		message: string;
		onretry?: () => void;
	} = $props();
</script>

<div class="error-state">
	<span class="empty-icon" style="background: var(--danger-bg); color: var(--danger);">
		<TriangleAlert size={18} strokeWidth={1.9} />
	</span>
	<p>{message}</p>
	{#if onretry}
		<button type="button" class="btn btn-ghost btn-sm" onclick={onretry}>
			<RefreshCw size={14} strokeWidth={2} />
			Retry
		</button>
	{/if}
</div>
