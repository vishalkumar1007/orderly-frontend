<script lang="ts">
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import Info from '@lucide/svelte/icons/info';
	import X from '@lucide/svelte/icons/x';
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
				<CircleCheck size={16} strokeWidth={2} />
			{:else if t.kind === 'error'}
				<CircleX size={16} strokeWidth={2} />
			{:else if t.kind === 'warn'}
				<CircleAlert size={16} strokeWidth={2} />
			{:else}
				<Info size={16} strokeWidth={2} />
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
				<X size={14} strokeWidth={2} />
			</button>
		</div>
	{/each}
</div>
