<script lang="ts">
	import type { ProductPoint } from '$lib/tenant/analytics';
	import Skeleton from '../Skeleton.svelte';
	import ChartPanel from './ChartPanel.svelte';

	type Metric = 'units' | 'revenue';

	/**
	 * The five products that sold best, ranked by volume or revenue. One list
	 * with an inline bar per row: the bar is the chart, so nothing is drawn
	 * twice. Categories have their own panel beside this one.
	 */
	let {
		products = [] as ProductPoint[],
		productsByRevenue = [] as ProductPoint[],
		money = (n: number) => String(n),
		loading = false
	}: {
		products?: ProductPoint[];
		productsByRevenue?: ProductPoint[];
		money?: (n: number) => string;
		loading?: boolean;
	} = $props();

	let metric = $state<Metric>('units');

	const all = $derived(metric === 'revenue' ? productsByRevenue : products);
	const rows = $derived(all.slice(0, 5));
	const peak = $derived(Math.max(...rows.map((r) => Number(r[metric] ?? 0)), 1));
	const value = (row: ProductPoint) => (metric === 'units' ? `${row.units} sold` : money(row.revenue));
	const secondary = (row: ProductPoint) => (metric === 'units' ? money(row.revenue) : `${row.units} sold`);
</script>

<ChartPanel
	title="Best sellers"
	subtitle={rows.length > 0 ? `Top ${rows.length} products by ${metric === 'units' ? 'items sold' : 'revenue'}` : ''}
	extra="menu-panel"
>
	{#snippet actions()}
		<div class="toggle" role="tablist" aria-label="Rank by">
			<button type="button" role="tab" aria-selected={metric === 'units'} class:active={metric === 'units'} onclick={() => (metric = 'units')}>
				Volume
			</button>
			<button type="button" role="tab" aria-selected={metric === 'revenue'} class:active={metric === 'revenue'} onclick={() => (metric = 'revenue')}>
				Revenue
			</button>
		</div>
	{/snippet}

	{#if loading}
		<div class="rows">
			{#each [1, 2, 3] as _, i (i)}
				<Skeleton height="2.4rem" />
			{/each}
		</div>
	{:else if rows.length === 0}
		<div class="empty">No sales in this window yet</div>
	{:else}
		<ol class="rows">
			{#each rows as row, i (row.name)}
				<li>
					<span class="rank" class:first={i === 0}>{i + 1}</span>
					<span class="row-main">
						<span class="line">
							<span class="name">{row.name}</span>
							<span class="metrics">
								<span class="secondary">{secondary(row)}</span>
								<span class="qty">{value(row)}</span>
							</span>
						</span>
						<span class="track">
							<span class="fill" style={`width:${Math.max((Number(row[metric] ?? 0) / peak) * 100, 4)}%`}></span>
						</span>
					</span>
				</li>
			{/each}
		</ol>
	{/if}

	{#snippet footer()}
		{#if !loading && rows.length > 0}
			<strong>{rows[0].name}</strong> leads, with {value(rows[0])}.
		{:else}
			Ranked by volume or revenue.
		{/if}
	{/snippet}
</ChartPanel>

<style>
	.rows {
		flex: 1;
		list-style: none;
		margin: 0;
		padding: 0.5rem 1.25rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.rows li {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}

	.rank {
		flex: none;
		width: 1.5rem;
		height: 1.5rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		color: var(--text-3);
		font-size: var(--fs-label);
		font-weight: 650;
		font-variant-numeric: tabular-nums;
	}

	.rank.first {
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: color-mix(in srgb, var(--accent) 86%, #000);
	}

	.row-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.line {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.name {
		font-size: var(--fs-body);
		font-weight: 550;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.metrics {
		flex-shrink: 0;
		display: inline-flex;
		align-items: baseline;
		gap: 0.6rem;
		font-variant-numeric: tabular-nums;
	}

	.qty {
		font-size: var(--fs-code);
		font-weight: 650;
		color: var(--text);
	}

	.secondary {
		font-size: var(--fs-meta);
		color: var(--text-3);
		white-space: nowrap;
	}

	.track {
		display: block;
		height: 6px;
		border-radius: 999px;
		background: var(--surface-2);
		overflow: hidden;
	}

	.fill {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: color-mix(in srgb, var(--accent) 86%, #000);
		transition: width 0.4s ease;
	}

	.rows li:not(:first-child) .fill {
		background: color-mix(in srgb, var(--accent) 55%, transparent);
	}

	.empty {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 160px;
		padding: 0 1.25rem;
		font-size: var(--fs-body);
		color: var(--text-3);
		text-align: center;
	}

	.toggle {
		display: inline-flex;
		padding: 2px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
	}

	.toggle button {
		padding: 0.24rem 0.55rem;
		border: 0;
		border-radius: calc(var(--radius-sm) - 1px);
		background: transparent;
		color: var(--text-3);
		font: inherit;
		font-size: var(--fs-code);
		font-weight: 550;
		cursor: pointer;
		transition: background var(--tr), color var(--tr);
	}

	.toggle button.active {
		background: var(--surface);
		color: var(--text);
		box-shadow: 0 1px 2px color-mix(in srgb, var(--text) 8%, transparent);
	}

	@media (max-width: 520px) {
		.secondary {
			display: none;
		}
	}
</style>
