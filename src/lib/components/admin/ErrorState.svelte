<script lang="ts">
	import TriangleAlert from '@tabler/icons-svelte/icons/alert-triangle';
	import RefreshCw from '@tabler/icons-svelte/icons/refresh';

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
		<TriangleAlert size={18} stroke={1.6} />
	</span>
	<p>{message}</p>
	{#if onretry}
		<button type="button" class="btn btn-ghost btn-sm" onclick={onretry}>
			<RefreshCw size={14} stroke={1.6} />
			Retry
		</button>
	{/if}
</div>
