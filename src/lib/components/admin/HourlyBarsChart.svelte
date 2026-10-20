<script lang="ts">
	import EChart, { alpha, type ChartTokens } from '$lib/components/charts/EChart.svelte';
	import Skeleton from './Skeleton.svelte';
	import type { HourPoint, WeekHourPoint } from '$lib/tenant/analytics';

	/**
	 * When orders come in: a weekday by hour grid on the shop's own clock, so
	 * "Friday evenings are the rush" is visible at a glance and written out
	 * underneath. Without the grid (an older server) it falls back to orders
	 * by hour.
	 */
	let {
		title = 'Busiest hours',
		data = [] as HourPoint[],
		grid = [] as WeekHourPoint[],
		days = 30,
		loading = false,
		emptyLabel = 'No orders in this window'
	}: {
		title?: string;
		/** Average orders per day for each hour. */
		data?: HourPoint[];
		/** Order totals per weekday (0 = Monday) and hour. */
		grid?: WeekHourPoint[];
		/** Length of the window, for the summary line. */
		days?: number;
		loading?: boolean;
		emptyLabel?: string;
	} = $props();

	const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
	const hourLabel = (h: number) => {
		const hh = ((h % 24) + 24) % 24;
		return hh === 0 ? '12 AM' : hh === 12 ? '12 PM' : hh < 12 ? `${hh} AM` : `${hh - 12} PM`;
	};
	const shortHour = (h: number) => hourLabel(h).replace(' AM', 'a').replace(' PM', 'p');

	const cells = $derived(grid.filter((c) => c.order_count > 0));
	const useGrid = $derived(cells.length > 0);
	const total = $derived(
		useGrid ? cells.reduce((s, c) => s + c.order_count, 0) : Math.round(data.reduce((s, p) => s + p.order_count, 0) * days)
	);
	const hasData = $derived(useGrid || data.some((p) => p.order_count > 0));

	/** Orders per hour across the whole week. */
	const byHour = $derived.by(() => {
		const out = Array<number>(24).fill(0);
		if (useGrid) for (const c of cells) out[c.hour] += c.order_count;
		else for (const p of data) out[p.hour] = p.order_count;
		return out;
	});

	/** Hours worth drawing: the trading day plus an hour either side, at least 12. */
	const span = $derived.by(() => {
		const busy = byHour.map((v, h) => (v > 0 ? h : -1)).filter((h) => h >= 0);
		if (!busy.length) return { from: 8, to: 23 };
		let from = Math.max(0, busy[0] - 1);
		let to = Math.min(23, busy[busy.length - 1] + 1);
		while (to - from < 11) {
			if (from > 0) from--;
			if (to - from < 11 && to < 23) to++;
			if (from === 0 && to === 23) break;
		}
		return { from, to };
	});
	const hours = $derived(Array.from({ length: span.to - span.from + 1 }, (_, i) => span.from + i));

	/** The busiest stretch of up to two hours, trimmed to hours that had orders. */
	const rush = $derived.by(() => {
		let best = -1;
		let at = 0;
		for (let h = 0; h < 24; h++) {
			const v = byHour[h] + (byHour[(h + 1) % 24] ?? 0);
			// On a tie, start where the orders are, not an hour early.
			if (v > best || (v === best && byHour[h] > byHour[at])) [best, at] = [v, h];
		}
		if (best <= 0) return '';
		const length = byHour[at] > 0 && byHour[(at + 1) % 24] > 0 ? 2 : 1;
		const from = byHour[at] > 0 ? at : at + 1;
		return `${hourLabel(from)} and ${hourLabel(from + length)}`;
	});

	const busiestDay = $derived.by(() => {
		if (!useGrid) return null;
		const perDay = Array<number>(7).fill(0);
		for (const c of cells) perDay[c.weekday] += c.order_count;
		const max = Math.max(...perDay);
		return max > 0 ? { name: DAY_NAMES[perDay.indexOf(max)], count: max } : null;
	});

	function build(t: ChartTokens) {
		const base = {
			textStyle: { fontFamily: t.font },
			tooltip: {
				backgroundColor: t.surface,
				borderColor: t.border,
				padding: [8, 12],
				textStyle: { color: t.text, fontSize: 12 },
				extraCssText: 'box-shadow:0 8px 24px rgba(0,0,0,.18);border-radius:8px;'
			}
		};
		const axisText = { color: t.text3, fontSize: 11 };

		if (!useGrid) {
			return {
				...base,
				grid: { left: 4, right: 8, top: 16, bottom: 4, containLabel: true },
				tooltip: {
					...base.tooltip,
					trigger: 'axis',
					axisPointer: { type: 'shadow', shadowStyle: { color: alpha(t.accent, 0.08) } },
					formatter: (p: Array<{ dataIndex: number; value: number }>) =>
						`${hourLabel(hours[p[0].dataIndex])} to ${hourLabel(hours[p[0].dataIndex] + 1)}<br/><b>${p[0].value.toFixed(1)}</b> orders a day on average`
				},
				xAxis: { type: 'category', data: hours.map(shortHour), axisTick: { show: false }, axisLine: { lineStyle: { color: t.border } }, axisLabel: { ...axisText, interval: 1 } },
				yAxis: { type: 'value', splitNumber: 3, axisLabel: axisText, splitLine: { lineStyle: { color: t.grid, type: 'dashed' } } },
				series: [{ type: 'bar', data: hours.map((h) => byHour[h]), barMaxWidth: 18, itemStyle: { color: t.accent, borderRadius: [4, 4, 0, 0] } }]
			};
		}

		const lookup = new Map(cells.map((c) => [`${c.weekday}:${c.hour}`, c.order_count]));
		const max = Math.max(...cells.map((c) => c.order_count));
		const points: [number, number, number][] = [];
		for (let d = 0; d < 7; d++) {
			hours.forEach((h, x) => points.push([x, d, lookup.get(`${d}:${h}`) ?? 0]));
		}
		return {
			...base,
			grid: { left: 4, right: 8, top: 6, bottom: 4, containLabel: true },
			tooltip: {
				...base.tooltip,
				formatter: (p: { value: [number, number, number] }) => {
					const [x, d, v] = p.value;
					return `${DAY_NAMES[d]}, ${hourLabel(hours[x])} to ${hourLabel(hours[x] + 1)}<br/><b>${v}</b> ${v === 1 ? 'order' : 'orders'}`;
				}
			},
			xAxis: {
				type: 'category',
				data: hours.map(shortHour),
				splitArea: { show: false },
				axisTick: { show: false },
				axisLine: { show: false },
				axisLabel: { ...axisText, interval: (i: number) => i % 2 === 0 }
			},
			yAxis: {
				type: 'category',
				data: DAYS,
				inverse: true,
				axisTick: { show: false },
				axisLine: { show: false },
				axisLabel: axisText
			},
			visualMap: {
				show: false,
				min: 0,
				max: Math.max(1, max),
				inRange: { color: [t.surface2, alpha(t.accent, 0.35), t.accent] }
			},
			series: [
				{
					type: 'heatmap',
					data: points,
					itemStyle: { borderColor: t.surface, borderWidth: 3, borderRadius: 4 },
					emphasis: { itemStyle: { borderColor: t.text2, borderWidth: 1 } }
				}
			]
		};
	}
</script>

<section class="panel">
	<div class="head">
		<h3 class="panel-h" style="margin:0;">{title}</h3>
		{#if hasData}
			<p class="sub">{total} {total === 1 ? 'order' : 'orders'} in the last {days} days</p>
		{/if}
	</div>

	{#if loading}
		<div class="frame"><Skeleton height="200px" /></div>
	{:else if !hasData}
		<div class="empty">{emptyLabel}</div>
	{:else}
		<div class="frame">
			<EChart {build} height={useGrid ? 210 : 190} label="{title}. Most orders come in between {rush}." />
		</div>
		<p class="foot">
			{#if rush}<span class="insight">Most orders come in between {rush}.</span>{/if}
			{#if busiestDay}{busiestDay.name} is your busiest day, with {busiestDay.count} {busiestDay.count === 1 ? 'order' : 'orders'}.{/if}
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
		align-items: baseline;
		justify-content: space-between;
		gap: 0.6rem;
		padding: 0.9rem 1rem 0.4rem;
	}

	.panel-h {
		font-size: var(--fs-body);
		font-weight: 600;
	}

	.sub {
		margin: 0;
		font-size: var(--fs-code);
		color: var(--text-3);
		font-variant-numeric: tabular-nums;
	}

	.frame {
		padding: 0 0.5rem;
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

	.empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 200px;
		font-size: var(--fs-body);
		color: var(--text-3);
	}
</style>
