<script lang="ts">
	import type { CategoryPoint } from '$lib/tenant/analytics';
	import Skeleton from '../Skeleton.svelte';
	import ChartPanel from './ChartPanel.svelte';

	/**
	 * Which parts of the menu earn the money, as ranked bars: one hue, longest
	 * at the top, the revenue and share written beside each bar so nobody has
	 * to hover or compare areas by eye.
	 */
	let {
		categories = [] as CategoryPoint[],
		money = (n: number) => String(n),
		loading = false
	}: {
		categories?: CategoryPoint[];
		money?: (n: number) => string;
		loading?: boolean;
	} = $props();

	const MAX = 6;

	const ranked = $derived(
		categories
			.map((c) => ({ name: c.name, revenue: Number(c.revenue ?? 0), units: Number(c.units ?? 0) }))
			.filter((c) => c.revenue > 0)
			.sort((a, b) => b.revenue - a.revenue)
	);
	// Everything past the top six folds into one row rather than a seventh bar.
	const rows = $derived.by(() => {
		if (ranked.length <= MAX) return ranked;
		const head = ranked.slice(0, MAX - 1);
		const rest = ranked.slice(MAX - 1);
		return [
			...head,
			{
				name: `Other (${rest.length})`,
				revenue: rest.reduce((s, r) => s + r.revenue, 0),
				units: rest.reduce((s, r) => s + r.units, 0)
			}
		];
	});
	const total = $derived(rows.reduce((sum, r) => sum + r.revenue, 0));
	const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
	const shareWidth = (v: number) => (total > 0 ? Math.max((v / total) * 100, 4) : 0);
</script>

<ChartPanel
	title="Category share"
	subtitle={rows.length > 0 ? `${money(total)} across ${ranked.length} ${ranked.length === 1 ? 'category' : 'categories'}` : ''}
	extra="category-panel"
>
	{#if loading}
		<div class="rows">
			{#each [1, 2, 3] as _, i (i)}
				<Skeleton height="2.4rem" />
			{/each}
		</div>
	{:else if rows.length === 0}
		<div class="empty">No category sales in this window yet</div>
	{:else}
		<ol class="rows" aria-label="Revenue share by menu category">
			{#each rows as r, i (r.name)}
				{@const isOther = i === MAX - 1 && rows.length === MAX && r.name.startsWith('Other')}
				<li>
					<span class="rank" class:first={i === 0}>{i + 1}</span>
					<span class="row-main">
						<span class="line">
							<span class="title-group">
								<span class="name">{r.name}</span>
								<span class="units">{r.units.toLocaleString('en-IN')} sold</span>
							</span>
							<span class="metrics">
								<span class="rev">{money(r.revenue)}</span>
								<span class="pct">{pct(r.revenue)}%</span>
							</span>
						</span>
						<span class="track">
							<span
								class="fill"
								class:muted={isOther}
								style={`width:${shareWidth(r.revenue)}%`}
							></span>
						</span>
					</span>
				</li>
			{/each}
		</ol>
	{/if}

	{#snippet footer()}
		{#if !loading && rows.length > 0}
			<strong>{rows[0].name}</strong> leads, at {pct(rows[0].revenue)}% of category revenue.
		{:else}
			Bar length shows each category's share of revenue.
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

	.title-group {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		min-width: 0;
	}

	.name {
		font-size: var(--fs-body);
		font-weight: 550;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.units {
		flex-shrink: 0;
		font-size: var(--fs-meta);
		color: var(--text-3);
		font-variant-numeric: tabular-nums;
	}

	.metrics {
		flex-shrink: 0;
		display: inline-flex;
		align-items: baseline;
		gap: 0.6rem;
		font-variant-numeric: tabular-nums;
	}

	.rev {
		font-size: var(--fs-meta);
		color: var(--text-3);
	}

	.pct {
		font-size: var(--fs-code);
		font-weight: 650;
		color: var(--text);
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

	.fill.muted {
		background: color-mix(in srgb, var(--accent) 35%, transparent);
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
</style>
