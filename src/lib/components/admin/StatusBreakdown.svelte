<script lang="ts">
	import type { TenantStatusBreakdown } from '$lib/admin/types';
	import StatusBadge from './StatusBadge.svelte';

	let {
		rows = [] as TenantStatusBreakdown[],
		loading = false
	}: {
		rows?: TenantStatusBreakdown[];
		loading?: boolean;
	} = $props();

	/** Workflow order, not magnitude, so the bars read as a pipeline. */
	const ORDER = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];

	const sorted = $derived(
		[...rows].sort((a, b) => {
			const ai = ORDER.indexOf(a.status);
			const bi = ORDER.indexOf(b.status);
			return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
		})
	);

	const total = $derived(rows.reduce((sum, r) => sum + r.count, 0));
	const max = $derived(Math.max(...rows.map((r) => r.count), 1));

	function tone(status: string): string {
		if (status === 'COMPLETED') return 'var(--success)';
		if (status === 'CANCELLED') return 'var(--danger)';
		if (status === 'READY') return 'var(--info)';
		return 'var(--accent)';
	}
</script>

<section class="panel">
	<div class="bento-head">
		<h3 class="panel-h" style="margin:0;">Order pipeline</h3>
		<span class="bento-pill">{total} orders</span>
	</div>

	{#if loading}
		<div style="display:flex;flex-direction:column;gap:0.7rem;">
			{#each [1, 2, 3] as _, i (i)}<div class="skeleton" style="height:1.5rem;"></div>{/each}
		</div>
	{:else if sorted.length === 0}
		<p class="muted" style="font-size:var(--fs-body);margin:0;">No orders placed yet.</p>
	{:else}
		<div class="pipe">
			{#each sorted as row (row.status)}
				{@const pct = Math.round((row.count / total) * 100)}
				<div class="pipe-row">
					<div class="pipe-top">
						<StatusBadge status={row.status} dot={false} />
						<span class="pipe-count">
							<strong>{row.count}</strong>
							<span class="muted">{pct}%</span>
						</span>
					</div>
					<div class="pipe-bar">
						<i
							style:width="{Math.max((row.count / max) * 100, 2)}%"
							style:background={tone(row.status)}
						></i>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>

<style>
	.pipe {
		display: grid;
		gap: 0.7rem;
	}

	.pipe-row {
		display: grid;
		gap: 0.3rem;
	}

	.pipe-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.pipe-count {
		display: flex;
		align-items: baseline;
		gap: 0.35rem;
		font-size: var(--fs-tab);
	}

	.pipe-count strong {
		font-variant-numeric: tabular-nums;
	}

	.pipe-count .muted {
		font-size: var(--fs-meta);
	}

	.pipe-bar {
		height: 5px;
		border-radius: 999px;
		background: var(--surface-3);
		overflow: hidden;
	}

	.pipe-bar i {
		display: block;
		height: 100%;
		border-radius: 999px;
		transition: width 0.35s ease;
	}
</style>
