<script lang="ts">
	import CircleCheck from '@tabler/icons-svelte/icons/circle-check';
	import CircleAlert from '@tabler/icons-svelte/icons/alert-circle';
	import CircleX from '@tabler/icons-svelte/icons/circle-x';
	import Info from '@tabler/icons-svelte/icons/info-circle';
	import X from '@tabler/icons-svelte/icons/x';
	import { toast } from './toast';

	function runAction(id: string, onClick: () => void) {
		onClick();
		toast.dismiss(id);
	}
</script>

<div class="toast-viewport" aria-live="polite">
	{#each $toast as t (t.id)}
		<div class={`toast-item ${t.kind}`} role="status">
			{#if t.kind === 'success'}
				<CircleCheck size={16} stroke={1.6} />
			{:else if t.kind === 'error'}
				<CircleX size={16} stroke={1.6} />
			{:else if t.kind === 'warn'}
				<CircleAlert size={16} stroke={1.6} />
			{:else}
				<Info size={16} stroke={1.6} />
			{/if}
			<span style="flex:1;min-width:0;">{t.message}</span>
			{#if t.action}
				<button
					type="button"
					class="btn btn-quiet btn-sm"
					onclick={() => runAction(t.id, t.action!.onClick)}
				>
					{t.action.label}
				</button>
			{/if}
			<button
				type="button"
				class="btn btn-quiet btn-sm"
				aria-label="Dismiss notification"
				onclick={() => toast.dismiss(t.id)}
			>
				<X size={14} stroke={1.6} />
			</button>
		</div>
	{/each}
</div>
