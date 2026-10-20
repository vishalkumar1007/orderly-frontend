<script lang="ts">
	import EChart, { alpha, darken, type ChartTokens } from '$lib/components/charts/EChart.svelte';
	import type { DayPoint, Granularity } from '$lib/tenant/analytics';
	import Skeleton from '../Skeleton.svelte';
	import ChartPanel from './ChartPanel.svelte';

	type Mode = 'both' | 'revenue' | 'orders';

	let {
		data = [] as DayPoint[],
		previous = [] as DayPoint[],
		loading = false,
		formatValue = (n: number) => String(n),
		granularity = 'day',
		ongranularity,
		allowed = { week: true, month: true }
	}: {
		data?: DayPoint[];
		/** Same length as `data`, paired by index. */
		previous?: DayPoint[];
		loading?: boolean;
		formatValue?: (n: number) => string;
		granularity?: Granularity;
		ongranularity?: (g: Granularity) => void;
		allowed?: { week: boolean; month: boolean };
	} = $props();

	const NOUN: Record<Granularity, string> = { day: 'day', week: 'week', month: 'month' };

	let mode = $state<Mode>('both');
	let compare = $state(true);

	const points = $derived(
		data.map((d, i) => {
			const p = previous[i];
			return {
				date: new Date(`${d.day}T12:00:00`),
				revenue: Number(d.revenue ?? 0),
				orders: Number(d.order_count ?? 0),
				prevDate: p ? new Date(`${p.day}T12:00:00`) : null,
				prevRevenue: Number(p?.revenue ?? 0),
				prevOrders: Number(p?.order_count ?? 0)
			};
		})
	);

	const hasData = $derived(points.some((p) => p.revenue > 0 || p.orders > 0));
	const hasCompare = $derived(previous.length === data.length && points.some((p) => p.prevRevenue > 0 || p.prevOrders > 0));

	const totals = $derived.by(() => {
		const revenue = points.reduce((s, p) => s + p.revenue, 0);
		const orders = points.reduce((s, p) => s + p.orders, 0);
		return {
			revenue,
			orders,
			prevRevenue: points.reduce((s, p) => s + p.prevRevenue, 0),
			prevOrders: points.reduce((s, p) => s + p.prevOrders, 0),
			average: orders > 0 ? revenue / orders : 0,
			perDay: points.length ? revenue / points.length : 0
		};
	});

	/** The totals live in the strip above, so the subtitle says how to read the chart. */
	const summary = $derived(
		`Per ${NOUN[granularity]}${hasCompare && compare ? ', previous period dashed' : ''}`
	);

	const label = (d: Date, long = false) =>
		granularity === 'month'
			? d.toLocaleDateString('en-GB', { month: long ? 'long' : 'short', year: 'numeric' })
			: d.toLocaleDateString('en-GB', { ...(long ? { weekday: 'short' } : {}), day: 'numeric', month: 'short' });

	const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
	const symbol = $derived(formatValue(0).replace(/[\d.,\s]/g, ''));
	const axisValue = (v: number) => `${symbol}${compact.format(v)}`;

	/** The one sentence the chart exists to say: better or worse than last time. */
	const insight = $derived.by(() => {
		const noun = mode === 'orders' ? 'Orders' : 'Revenue';
		const current = mode === 'orders' ? totals.orders : totals.revenue;
		const before = mode === 'orders' ? totals.prevOrders : totals.prevRevenue;
		if (!hasCompare || before <= 0) return '';
		const pct = Math.round(((current - before) / before) * 100);
		if (pct === 0) return `${noun} level with the previous period.`;
		return `${noun} ${pct > 0 ? 'up' : 'down'} ${Math.abs(pct)}% on the previous period.`;
	});

	const best = $derived.by(() => {
		let bestPoint: (typeof points)[number] | null = null;
		for (const p of points) {
			const value = mode === 'orders' ? p.orders : p.revenue;
			const bestValue = bestPoint ? (mode === 'orders' ? bestPoint.orders : bestPoint.revenue) : -1;
			if (value > 0 && value > bestValue) bestPoint = p;
		}
		return bestPoint;
	});

	function build(t: ChartTokens) {
		const revenueColour = darken(t.accent, t.dark ? 0.08 : 0.16);
		const ordersColour = revenueColour;
		const both = mode === 'both';
		const showRevenue = mode !== 'orders';
		const showOrders = mode !== 'revenue';

		const rows = (rows: Array<[string, string]>) =>
			rows
				.map(
					([k, v]) =>
						`<div style="display:flex;justify-content:space-between;gap:22px;line-height:1.6"><span style="color:${t.text3}">${k}</span><b style="font-variant-numeric:tabular-nums">${v}</b></div>`
				)
				.join('');

		const tip = (i: number) => {
			const p = points[i];
			const aov = p.orders ? formatValue(p.revenue / p.orders) : '-';
			const head = `<div style="font-weight:650;margin-bottom:6px">${label(p.date, true)}</div>`;
			const primary = both ? rows([['Revenue', formatValue(p.revenue)], ['Orders', String(p.orders)], ['Average order', aov]]) : showRevenue ? rows([['Revenue', formatValue(p.revenue)], ['Orders', String(p.orders)], ['Average order', aov]]) : rows([['Orders', String(p.orders)], ['Revenue', formatValue(p.revenue)], ['Average order', aov]]);
			const prev = hasCompare && compare && p.prevDate
				? `<div style="border-top:1px solid ${t.border};margin-top:7px;padding-top:6px">${rows([
						['Previous ' + label(p.prevDate), `${formatValue(p.prevRevenue)}, ${p.prevOrders} orders`]
					])}</div>`
				: '';
			return head + primary + prev;
		};

		const base = {
			textStyle: { fontFamily: t.font },
			grid: { left: 4, right: both ? 8 : 18, top: 14, bottom: 4, containLabel: true },
			tooltip: {
				trigger: 'axis' as const,
				backgroundColor: t.card,
				borderColor: t.border,
				padding: [10, 12],
				textStyle: { color: t.text, fontSize: 12 },
				extraCssText: 'box-shadow:0 10px 28px rgba(0,0,0,.18);border-radius:10px;',
				axisPointer: { type: 'line' as const, lineStyle: { color: t.border } },
				formatter: (params: Array<{ dataIndex: number }>) => tip(params[0].dataIndex)
			},
			xAxis: {
				type: 'category' as const,
				boundaryGap: both,
				data: points.map((p) => label(p.date)),
				axisLine: { lineStyle: { color: t.border } },
				axisTick: { show: false },
				axisLabel: { color: t.text3, fontSize: 11, hideOverlap: true, margin: 12 }
			}
		};

		const revenueAxis = {
			type: 'value' as const,
			splitNumber: 4,
			axisLabel: { color: t.text3, fontSize: 11, formatter: axisValue },
			splitLine: { lineStyle: { color: t.grid, type: 'dashed' as const } }
		};

		const ordersAxis = {
			type: 'value' as const,
			minInterval: 1,
			splitNumber: 4,
			axisLabel: { color: t.text3, fontSize: 11 },
			splitLine: { show: false }
		};

		const average = points.length ? totals.revenue / points.length : 0;

		const series: Record<string, unknown>[] = [];

		if (showOrders && both) {
			series.push({
				name: 'Orders',
				type: 'bar',
				yAxisIndex: 1,
				data: points.map((p) => p.orders),
				barMaxWidth: 20,
				itemStyle: { color: alpha(ordersColour, t.dark ? 0.32 : 0.2), borderRadius: [4, 4, 0, 0] },
				emphasis: { itemStyle: { color: alpha(ordersColour, t.dark ? 0.5 : 0.36) } }
			});
		}

		if (showRevenue) {
			series.push({
				name: 'Revenue',
				type: 'line',
				yAxisIndex: 0,
				smooth: 0.42,
				symbol: 'circle',
				symbolSize: 0,
				showSymbol: false,
				data: points.map((p) => p.revenue),
				lineStyle: {
					width: 2.8,
					color: revenueColour,
					shadowBlur: 12,
					shadowColor: alpha(revenueColour, t.dark ? 0.42 : 0.3),
					shadowOffsetY: 3
				},
				itemStyle: { color: revenueColour, borderColor: t.card, borderWidth: 2 },
				emphasis: { scale: 1.8, focus: 'none' },
				areaStyle: {
					color: {
						type: 'linear',
						x: 0,
						y: 0,
						x2: 0,
						y2: 1,
						colorStops: [
							{ offset: 0, color: alpha(revenueColour, t.dark ? 0.34 : 0.22) },
							{ offset: 1, color: alpha(revenueColour, 0) }
						]
					}
				},
				markLine: average > 0
					? {
							silent: true,
							symbol: 'none',
							lineStyle: { color: t.text3, type: 'dashed', width: 1 },
							label: {
								color: t.text3,
								fontSize: 11,
								position: 'insideEndTop',
								formatter: () => `Avg ${axisValue(average)}`
							},
							data: [{ yAxis: average }]
						}
					: undefined
			});
		}

		if (showOrders && !both) {
			series.push({
				name: 'Orders',
				type: 'line',
				yAxisIndex: 0,
				smooth: 0.42,
				showSymbol: false,
				symbolSize: 0,
				data: points.map((p) => p.orders),
				lineStyle: {
					width: 2.8,
					color: ordersColour,
					shadowBlur: 12,
					shadowColor: alpha(ordersColour, t.dark ? 0.42 : 0.3),
					shadowOffsetY: 3
				},
				itemStyle: { color: ordersColour, borderColor: t.card, borderWidth: 2 },
				emphasis: { scale: 1.8, focus: 'none' },
				areaStyle: {
					color: {
						type: 'linear',
						x: 0,
						y: 0,
						x2: 0,
						y2: 1,
						colorStops: [
							{ offset: 0, color: alpha(ordersColour, t.dark ? 0.32 : 0.2) },
							{ offset: 1, color: alpha(ordersColour, 0) }
						]
					}
				}
			});
		}

		if (hasCompare && compare) {
			series.push({
				name: 'Previous',
				type: 'line',
				yAxisIndex: 0,
				smooth: 0.2,
				showSymbol: false,
				data: points.map((p) => (showOrders && !showRevenue ? p.prevOrders : p.prevRevenue)),
				lineStyle: { width: 1.4, color: t.text3, type: 'dashed', opacity: t.dark ? 0.95 : 0.8 },
				itemStyle: { color: t.text3 },
				z: 1
			});
		}

		return {
			...base,
			yAxis: both ? [revenueAxis, ordersAxis] : showRevenue ? [revenueAxis] : [ordersAxis],
			series
		};
	}
</script>

<ChartPanel
	title="Revenue trend"
	subtitle={hasData || loading ? summary : ''}
	extra="trend-panel"
>
	{#snippet actions()}
		{#if ongranularity}
			<div class="toggle" role="tablist" aria-label="Group by">
				{#each ['day', 'week', 'month'] as g (g)}
					<button
						type="button"
						role="tab"
						aria-selected={granularity === g}
						class:active={granularity === g}
						disabled={(g === 'week' && !allowed.week) || (g === 'month' && !allowed.month)}
						onclick={() => ongranularity(g as Granularity)}
					>
						{g === 'day' ? 'Day' : g === 'week' ? 'Week' : 'Month'}
					</button>
				{/each}
			</div>
		{/if}

		<div class="toggle" role="tablist" aria-label="What to show">
			{#each [['both', 'Both'], ['revenue', 'Revenue'], ['orders', 'Orders']] as [value, text] (value)}
				<button
					type="button"
					role="tab"
					aria-selected={mode === value}
					class:active={mode === value}
					onclick={() => (mode = value as Mode)}
				>
					{text}
				</button>
			{/each}
		</div>

		{#if hasCompare}
			<button type="button" class="compare" class:on={compare} onclick={() => (compare = !compare)}>
				<span class="dash"></span> Compare
			</button>
		{/if}
	{/snippet}

	{#if loading}
		<div class="frame"><Skeleton height="300px" /></div>
	{:else if !hasData}
		<div class="empty">No orders in this window yet</div>
	{:else}
		<div class="legend" aria-hidden="true">
			{#if mode !== 'orders'}<span><i class="swatch rev"></i>Revenue</span>{/if}
			{#if mode !== 'revenue'}<span><i class="swatch ord"></i>Orders</span>{/if}
			{#if hasCompare && compare}<span><i class="swatch prev"></i>Previous</span>{/if}
		</div>
		<div class="frame">
			<EChart {build} height={300} label={`Revenue and orders per ${NOUN[granularity]}`} />
		</div>
	{/if}

	{#snippet footer()}
		{#if insight}<strong>{insight}</strong>{/if}
		{#if best}
			Best {NOUN[granularity]}: {label(best.date, true)}, {formatValue(best.revenue)} from {best.orders}
			{best.orders === 1 ? 'order' : 'orders'}.
		{/if}
	{/snippet}
</ChartPanel>

<style>
	.frame {
		flex: 1;
		display: flex;
		align-items: flex-end;
		padding: 0 0.75rem 0.5rem;
	}

	.frame > :global(*) {
		flex: 1;
	}

	.legend {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
		padding: 0 1.25rem 0.25rem;
		font-size: var(--fs-label);
		color: var(--text-3);
	}

	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}

	.swatch {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 2px;
	}

	.swatch.rev {
		background: var(--accent);
	}

	.swatch.ord {
		background: color-mix(in srgb, var(--accent) 28%, transparent);
	}

	.swatch.prev {
		width: 14px;
		height: 0;
		border-radius: 0;
		border-top: 1.5px dashed var(--text-3);
		background: none;
	}

	.empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 300px;
		padding: 0 1rem;
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

	.toggle button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.compare {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.26rem 0.55rem;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-3);
		font: inherit;
		font-size: var(--fs-code);
		font-weight: 550;
		cursor: pointer;
		transition: color var(--tr), border-color var(--tr);
	}

	.compare .dash {
		display: inline-block;
		width: 14px;
		height: 0;
		border-top: 1.5px dashed currentColor;
	}

	.compare.on {
		border-color: var(--border);
		color: var(--text-2);
	}

	.compare:hover {
		color: var(--text);
	}
</style>
