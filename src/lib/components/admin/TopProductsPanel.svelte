<script lang="ts">
	import Skeleton from './Skeleton.svelte';
	import type { ProductPoint } from '$lib/tenant/analytics';

	let {
		title = 'Best sellers',
		data = [] as ProductPoint[],
		loading = false,
		formatMoney = (n: number) => String(n),
		emptyLabel = 'No sales in this window'
	}: {
		title?: string;
		data?: ProductPoint[];
		loading?: boolean;
		formatMoney?: (n: number) => string;
		emptyLabel?: string;
	} = $props();

	/** Bars are relative to the leader, so the shape stays readable. */
	const peak = $derived(Math.max(...data.map((d) => d.units), 1));
	const units = $derived(data.reduce((sum, d) => sum + d.units, 0));
</script>

<section class="panel">
	<div class="head">
		<h3 class="panel-h" style="margin:0;">{title}</h3>
		{#if data.length > 0}
			<p class="sub">{units} sold</p>
		{/if}
	</div>

	{#if loading}
		<div class="body">
			{#each [1, 2, 3, 4] as _, i (i)}
				<Skeleton height="1.6rem" />
			{/each}
		</div>
	{:else if data.length === 0}
		<div class="empty">{emptyLabel}</div>
	{:else}
		<ul class="rows">
			{#each data as row, i (row.name)}
				<li>
					<span class="rank" class:top={i === 0}>{i + 1}</span>
					<span class="row-main">
						<span class="top">
							<span class="name">{row.name}</span>
							<span class="qty">{row.units}</span>
						</span>
						<span class="track">
							<span class="fill" style={`width:${Math.max((row.units / peak) * 100, 3)}%`}
							></span>
						</span>
						<span class="rev">{formatMoney(row.revenue)}</span>
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.panel {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-1);
		min-width: 0;
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.6rem;
		padding: 0.9rem 1rem 0.5rem;
	}

	.panel-h {
		font-size: 0.9rem;
		font-weight: 600;
	}

	.sub {
		margin: 0;
		font-size: 0.74rem;
		color: var(--text-3);
	}

	.rows {
		list-style: none;
		margin: 0;
		padding: 0.35rem 1rem 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.rows li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.rank {
		flex-shrink: 0;
		width: 1.25rem;
		height: 1.25rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text-3);
		font-size: 0.68rem;
		font-weight: 600;
	}

	.rank.top {
		background: color-mix(in srgb, var(--accent) 15%, transparent);
		color: var(--accent);
	}

	.row-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.name {
		font-size: 0.82rem;
		color: var(--text-1);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.qty {
		flex-shrink: 0;
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--text-1);
		font-variant-numeric: tabular-nums;
	}

	.track {
		display: block;
		height: 5px;
		border-radius: 3px;
		background: var(--surface-2);
		overflow: hidden;
	}

	.fill {
		display: block;
		height: 100%;
		border-radius: 3px;
		background: var(--accent);
	}

	.rev {
		font-size: 0.72rem;
		color: var(--text-3);
		font-variant-numeric: tabular-nums;
	}

	.empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 180px;
		font-size: 0.82rem;
		color: var(--text-3);
	}
</style>
