<script lang="ts">
	import EChart, { alpha, darken, type ChartTokens } from '$lib/components/charts/EChart.svelte';
	import type { CategoryPoint } from '$lib/tenant/analytics';
	import Skeleton from '../Skeleton.svelte';
	import ChartPanel from './ChartPanel.svelte';

	/**
	 * Which parts of the menu earn the money, as a treemap: tile size is
	 * revenue, so one glance shows whether the shop leans on a single category.
	 * Tiles step down the theme accent by rank.
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

	const STEPS = [1, 0.78, 0.6, 0.46, 0.34, 0.26];

	const rows = $derived(
		categories
			.map((c) => ({ name: c.name, revenue: Number(c.revenue ?? 0), units: Number(c.units ?? 0) }))
			.filter((c) => c.revenue > 0)
			.sort((a, b) => b.revenue - a.revenue)
			.slice(0, 8)
	);
	const total = $derived(rows.reduce((sum, r) => sum + r.revenue, 0));
	const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

	function build(t: ChartTokens) {
		const base = darken(t.accent, t.dark ? 0.06 : 0.14);
		return {
			textStyle: { fontFamily: t.font },
			tooltip: {
				backgroundColor: t.card,
				borderColor: t.border,
				padding: [9, 12],
				textStyle: { color: t.text, fontSize: 12 },
				extraCssText: 'box-shadow:0 10px 28px rgba(0,0,0,.18);border-radius:10px;',
				formatter: (p: { name: string }) => {
					const r = rows.find((row) => row.name === p.name);
					if (!r) return '';
					return `<div style="font-weight:650;margin-bottom:4px">${r.name}</div>
						<div>${money(r.revenue)}, ${pct(r.revenue)}%</div>
						<div style="color:${t.text3}">${r.units} sold</div>`;
				}
			},
			series: [
				{
					type: 'treemap',
					left: 0,
					right: 0,
					top: 0,
					bottom: 0,
					roam: false,
					nodeClick: false,
					breadcrumb: { show: false },
					squareRatio: 1.2,
					itemStyle: { borderColor: t.card, borderWidth: 3, gapWidth: 3, borderRadius: 6 },
					emphasis: { itemStyle: { borderColor: t.card } },
					label: {
						show: true,
						position: 'insideTopLeft',
						padding: [8, 10],
						overflow: 'truncate',
						formatter: (p: { name: string; value: number }) => `{name|${p.name}}\n{pct|${pct(p.value)}%}`,
						rich: {
							name: { fontSize: 12, fontWeight: 600, lineHeight: 18 },
							pct: { fontSize: 11, lineHeight: 16, opacity: 0.8 }
						}
					},
					upperLabel: { show: false },
					data: rows.map((r, i) => {
						const step = STEPS[Math.min(i, STEPS.length - 1)];
						return {
							name: r.name,
							value: r.revenue,
							itemStyle: { color: alpha(base, step) },
							label: { color: step >= 0.6 ? '#fff' : t.text }
						};
					})
				}
			]
		};
	}
</script>

<ChartPanel
	title="Category share"
	subtitle={rows.length > 0 ? `${money(total)} across ${rows.length} ${rows.length === 1 ? 'category' : 'categories'}` : ''}
	extra="category-panel"
>
	{#if loading}
		<div class="frame"><Skeleton height="264px" /></div>
	{:else if rows.length === 0}
		<div class="empty">No category sales in this window yet</div>
	{:else}
		<div class="frame">
			<EChart {build} height={264} label="Revenue by menu category" />
		</div>
	{/if}

	{#snippet footer()}
		{#if !loading && rows.length > 0}
			<strong>{rows[0].name}</strong> leads, at {pct(rows[0].revenue)}% of category revenue.
		{:else}
			Tile size shows each category's revenue.
		{/if}
	{/snippet}
</ChartPanel>

<style>
	.frame {
		flex: 1;
		padding: 0.5rem 1.25rem 1.25rem;
	}

	.empty {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 264px;
		padding: 0 1.25rem;
		font-size: var(--fs-body);
		color: var(--text-3);
		text-align: center;
	}
</style>
