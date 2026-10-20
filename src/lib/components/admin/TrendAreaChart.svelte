<script lang="ts">
	import EChart, { alpha, type ChartTokens } from '$lib/components/charts/EChart.svelte';
	import Skeleton from './Skeleton.svelte';
	import type { DayPoint } from '$lib/tenant/analytics';

	type Metric = 'revenue' | 'orders';
	type Granularity = 'day' | 'week' | 'month';

	let {
		title = 'Performance',
		data = [] as DayPoint[],
		loading = false,
		formatValue = (n: number) => String(n),
		emptyLabel = 'No orders in this window',
		granularity = 'day',
		ongranularity,
		allowed = { week: true, month: true }
	}: {
		title?: string;
		/** `day` is the first day of each bucket (Monday for weeks, the 1st for months). */
		data?: DayPoint[];
		loading?: boolean;
		formatValue?: (n: number) => string;
		emptyLabel?: string;
		granularity?: Granularity;
		/** When set, the chart shows a Day / Week / Month switch. */
		ongranularity?: (g: Granularity) => void;
		/** Buckets that make no sense for the selected window are disabled. */
		allowed?: { week: boolean; month: boolean };
	} = $props();

	const UNIT = { day: 'daily', week: 'weekly', month: 'monthly' } as const;
	const NOUN = { day: 'day', week: 'week', month: 'month' } as const;

	let active = $state<Metric>('revenue');

	// Anchor at midday so a day label never lands on a DST-shifted instant.
	const points = $derived(
		data.map((d) => ({
			date: new Date(`${d.day}T12:00:00`),
			revenue: Number(d.revenue ?? 0),
			orders: Number(d.order_count ?? 0)
		}))
	);

	const hasData = $derived(points.some((p) => p.revenue > 0 || p.orders > 0));
	const values = $derived(points.map((p) => p[active]));
	const total = $derived(values.reduce((sum, v) => sum + v, 0));
	const average = $derived(points.length ? total / points.length : 0);
	const show = (v: number) => (active === 'revenue' ? formatValue(v) : `${v} ${v === 1 ? 'order' : 'orders'}`);

	const label = (d: Date, long = false) =>
		granularity === 'month'
			? d.toLocaleDateString('en-GB', { month: long ? 'long' : 'short', year: 'numeric' })
			: d.toLocaleDateString('en-GB', { ...(long ? { weekday: 'short' } : {}), day: 'numeric', month: 'short' });

	const summary = $derived(
		active === 'revenue'
			? `${formatValue(total)} in total, ${formatValue(average)} ${UNIT[granularity]} average`
			: `${total} ${total === 1 ? 'order' : 'orders'}, ${average.toFixed(1)} per ${NOUN[granularity]}`
	);

	/**
	 * The one sentence a manager wants: is it getting better or worse? Days
	 * compare the recent half of the window with the half before it; weeks and
	 * months compare the last full bucket with the one before, because the
	 * current one is still filling up.
	 */
	const insight = $derived.by(() => {
		const what = active === 'revenue' ? 'Revenue' : 'Orders';
		if (granularity === 'day') {
			const half = Math.floor(values.length / 2);
			if (half < 2) return '';
			const recent = values.slice(-half).reduce((a, b) => a + b, 0);
			const before = values.slice(-2 * half, -half).reduce((a, b) => a + b, 0);
			const span = `the previous ${half} days`;
			if (before === 0) return recent > 0 ? `${what} all came in the last ${half} days.` : '';
			const pct = Math.round(((recent - before) / before) * 100);
			if (pct === 0) return `${what} level with ${span}.`;
			return `${what} ${pct > 0 ? 'up' : 'down'} ${Math.abs(pct)}% on ${span}.`;
		}
		if (values.length < 3) return '';
		const last = values[values.length - 2];
		const prev = values[values.length - 3];
		const noun = NOUN[granularity];
		if (prev === 0) return last > 0 ? `Last full ${noun}: ${show(last)}.` : '';
		const pct = Math.round(((last - prev) / prev) * 100);
		return `Last full ${noun}: ${show(last)}, ${pct === 0 ? 'level with' : `${pct > 0 ? 'up' : 'down'} ${Math.abs(pct)}% on`} the ${noun} before.`;
	});

	const best = $derived.by(() => {
		let i = -1;
		values.forEach((v, j) => {
			if (v > 0 && (i < 0 || v > values[i])) i = j;
		});
		return i < 0 ? null : points[i];
	});

	/**
	 * A few sales days in a long window read better as bars: a line would sit
	 * on zero for weeks and then jump, and an average of mostly zeros says
	 * nothing.
	 */
	const sparse = $derived(values.filter((v) => v > 0).length <= Math.max(3, values.length * 0.2));

	/** Axis numbers stay short: ₹1.2k, not ₹1,200.00. */
	const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
	const symbol = $derived(formatValue(0).replace(/[\d.,\s]/g, ''));
	const axisValue = (v: number) => (active === 'revenue' ? `${symbol}${compact.format(v)}` : compact.format(v));

	function build(t: ChartTokens) {
		const colour = active === 'revenue' ? t.accent : t.accent2;
		const tip = (i: number) => {
			const p = points[i];
			const aov = p.orders ? formatValue(p.revenue / p.orders) : '-';
			const row = (k: string, v: string) =>
				`<div style="display:flex;justify-content:space-between;gap:18px"><span style="color:${t.text3}">${k}</span><b>${v}</b></div>`;
			return (
				`<div style="font-weight:600;margin-bottom:6px">${label(p.date, true)}</div>` +
				row('Revenue', formatValue(p.revenue)) +
				row('Orders', String(p.orders)) +
				row('Average order', aov)
			);
		};
		return {
			textStyle: { fontFamily: t.font },
			grid: { left: 4, right: 18, top: 28, bottom: 4, containLabel: true },
			tooltip: {
				trigger: 'axis',
				backgroundColor: t.surface,
				borderColor: t.border,
				padding: [10, 12],
				textStyle: { color: t.text, fontSize: 12 },
				extraCssText: 'box-shadow:0 8px 24px rgba(0,0,0,.18);border-radius:8px;',
				axisPointer: { type: 'line', lineStyle: { color: t.border } },
				formatter: (params: Array<{ dataIndex: number }>) => tip(params[0].dataIndex)
			},
			xAxis: {
				type: 'category',
				boundaryGap: sparse,
				data: points.map((p) => label(p.date)),
				axisLine: { lineStyle: { color: t.border } },
				axisTick: { show: false },
				axisLabel: { color: t.text3, fontSize: 11, hideOverlap: true, margin: 12 }
			},
			yAxis: {
				type: 'value',
				minInterval: active === 'orders' ? 1 : undefined,
				splitNumber: 4,
				axisLabel: { color: t.text3, fontSize: 11, formatter: axisValue },
				splitLine: { lineStyle: { color: t.grid, type: 'dashed' } }
			},
			series: [
				sparse
					? {
							type: 'bar',
							data: values,
							barMaxWidth: 22,
							barMinHeight: 0,
							itemStyle: { color: colour, borderRadius: [4, 4, 0, 0] }
						}
					: {
							type: 'line',
							smooth: 0.25,
							data: values.map((v) => ({ value: v, symbol: v > 0 ? 'circle' : 'none' })),
							symbolSize: 6,
							lineStyle: { width: 2.5, color: colour },
							itemStyle: { color: colour, borderColor: t.surface, borderWidth: 2 },
							emphasis: { focus: 'none', scale: 1.6 },
							areaStyle: {
								color: {
									type: 'linear',
									x: 0,
									y: 0,
									x2: 0,
									y2: 1,
									colorStops: [
										{ offset: 0, color: alpha(colour, 0.3) },
										{ offset: 1, color: alpha(colour, 0) }
									]
								}
							},
							markLine: average > 0
								? {
										silent: true,
										symbol: 'none',
										lineStyle: { color: t.text3, type: 'dashed', width: 1 },
										label: { color: t.text3, fontSize: 11, position: 'insideEndTop', formatter: () => `Average ${axisValue(average)}` },
										data: [{ yAxis: average }]
									}
								: undefined
						}
			]
		};
	}
</script>

<section class="panel">
	<div class="head">
		<div>
			<h3 class="panel-h" style="margin:0;">{title}</h3>
			<p class="sub">{summary}</p>
		</div>
		<div class="controls">
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
			<div class="toggle" role="tablist" aria-label="Metric">
				<button type="button" role="tab" aria-selected={active === 'revenue'} class:active={active === 'revenue'} onclick={() => (active = 'revenue')}>Revenue</button>
				<button type="button" role="tab" aria-selected={active === 'orders'} class:active={active === 'orders'} onclick={() => (active = 'orders')}>Orders</button>
			</div>
		</div>
	</div>

	{#if loading}
		<div class="frame"><Skeleton height="240px" /></div>
	{:else if !hasData}
		<div class="empty">{emptyLabel}</div>
	{:else}
		<div class="frame">
			<EChart {build} height={240} label="{title}: {summary}" />
		</div>
		<p class="foot">
			{#if insight}<span class="insight">{insight}</span>{/if}
			{#if best}
				Best {NOUN[granularity]}: {label(best.date, true)}, {formatValue(best.revenue)} from {best.orders}
				{best.orders === 1 ? 'order' : 'orders'}.
			{/if}
			{#if granularity !== 'day'}The latest {NOUN[granularity]} is still in progress.{/if}
		</p>
	{/if}
</section>

<style>
	.panel {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		min-width: 0;
	}

	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.9rem 1rem 0.4rem;
		flex-wrap: wrap;
	}

	.panel-h {
		font-size: var(--fs-body);
		font-weight: 600;
		color: var(--text);
	}

	.sub {
		margin: 0.2rem 0 0;
		font-size: var(--fs-code);
		color: var(--text-3);
		font-variant-numeric: tabular-nums;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.toggle {
		display: inline-flex;
		padding: 2px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
	}

	.toggle button {
		padding: 0.25rem 0.6rem;
		border: 0;
		border-radius: calc(var(--radius-sm) - 1px);
		background: transparent;
		color: var(--text-3);
		font-size: var(--fs-code);
		font-weight: 500;
		cursor: pointer;
	}

	.toggle button.active {
		background: var(--surface);
		color: var(--text);
	}

	.toggle button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.frame {
		padding: 0 0.5rem;
	}

	.empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 240px;
		font-size: var(--fs-body);
		color: var(--text-3);
	}

	.foot {
		margin: 0;
		padding: 0.2rem 1rem 0.9rem;
		font-size: var(--fs-code);
		color: var(--text-3);
	}

	.insight {
		margin-right: 0.35rem;
		color: var(--text);
		font-weight: 500;
	}
</style>
