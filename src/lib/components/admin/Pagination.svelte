<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	let {
		total = 0,
		pageIndex = $bindable(0),
		pageSize = 10,
		noun = 'item',
		onchange
	}: {
		total?: number;
		pageIndex?: number;
		pageSize?: number;
		noun?: string;
		onchange?: (index: number) => void;
	} = $props();

	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));

	function go(i: number) {
		const next = Math.min(Math.max(i, 0), totalPages - 1);
		if (next === pageIndex) return;
		pageIndex = next;
		onchange?.(next);
	}

	const from = $derived(total === 0 ? 0 : pageIndex * pageSize + 1);
	const to = $derived(Math.min((pageIndex + 1) * pageSize, total));
</script>

{#if total > 0}
	<div class="pager">
		<span>
			{from}–{to} of {total} {noun}{total === 1 ? '' : 's'}
		</span>
		{#if totalPages > 1}
			<div class="pager-actions">
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					disabled={pageIndex === 0}
					onclick={() => go(pageIndex - 1)}
				>
					<ChevronLeft size={14} strokeWidth={2} />
					Prev
				</button>
				<span style="padding: 0 0.35rem;">{pageIndex + 1} / {totalPages}</span>
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					disabled={pageIndex >= totalPages - 1}
					onclick={() => go(pageIndex + 1)}
				>
					Next
					<ChevronRight size={14} strokeWidth={2} />
				</button>
			</div>
		{/if}
	</div>
{/if}
