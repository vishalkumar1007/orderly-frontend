<script lang="ts">
	import EChart, { alpha, darken, type ChartTokens } from '$lib/components/charts/EChart.svelte';
	import type { HourPoint, WeekHourPoint } from '$lib/tenant/analytics';
	import Skeleton from '../Skeleton.svelte';
	import ChartPanel from './ChartPanel.svelte';

	/**
	 * When the shop is busy. The heatmap answers "which evening?" and the strip
	 * above it answers "which day?", so the owner can plan staff around both
	 * without reading a table.
	 */
	let {
		data = [] as HourPoint[],
		grid = [] as WeekHourPoint[],
		days = 30,
		loading = false,
		formatValue = (n: number) => String(n)
	}: {
		/** Average orders per day for each hour. */
		data?: HourPoint[];
		/** Order totals per weekday (0 = Monday) and hour. */
		grid?: WeekHourPoint[];
		days?: number;
		loading?: boolean;
		formatValue?: (n: number) => string;
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

	const activeView = $derived(useGrid ? 'heatmap' : 'hours');

	const total = $derived(
		useGrid ? cells.reduce((s, c) => s + c.order_count, 0) : Math.round(data.reduce((s, p) => s + p.order_count, 0) * days)
	);
	const hasData = $derived(useGrid || data.some((p) => p.order_count > 0));

	const byHour = $derived.by(() => {
		const out = Array<number>(24).fill(0);
		if (useGrid) for (const c of cells) out[c.hour] += c.order_count;
		else for (const p of data) out[p.hour] = p.order_count;
		return out;
	});

	const revenueByHour = $derived.by(() => {
		const out = Array<number>(24).fill(0);
		for (const p of data) out[p.hour] = Number(p.revenue ?? 0);
		return out;
	});

	const weekTotals = $derived.by(() => {
		const out = Array<number>(7).fill(0);
		for (const c of cells) out[c.weekday] += c.order_count;
		return out;
	});

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

	const rush = $derived.by(() => {
		let best = -1;
		let at = 0;
		for (let h = 0; h < 24; h++) {
			const v = byHour[h] + (byHour[(h + 1) % 24] ?? 0);
			if (v > best || (v === best && byHour[h] > byHour[at])) [best, at] = [v, h];
		}
		if (best <= 0) return '';
		const length = byHour[at] > 0 && byHour[(at + 1) % 24] > 0 ? 2 : 1;
		const from = byHour[at] > 0 ? at : at + 1;
		return `between ${hourLabel(from)} and ${hourLabel(from + length)}`;
	});

	const busiestDay = $derived.by(() => {
		if (!useGrid) return null;
		const max = Math.max(...weekTotals);
		if (max <= 0) return null;
		const i = weekTotals.indexOf(max);
		return { name: DAY_NAMES[i], short: DAYS[i], count: max };
	});

	const peakHour = $derived.by(() => {
		const max = Math.max(...byHour);
		if (max <= 0) return null;
		const h = byHour.indexOf(max);
		return { hour: h, count: max, revenue: revenueByHour[h] ?? 0 };
	});

	function build(t: ChartTokens) {
		const accent = darken(t.accent, t.dark ? 0.06 : 0.14);
		const base = {
			textStyle: { fontFamily: t.font },
			tooltip: {
				backgroundColor: t.card,
				borderColor: t.border,
				padding: [9, 12],
				textStyle: { color: t.text, fontSize: 12 },
				extraCssText: 'box-shadow:0 10px 28px rgba(0,0,0,.18);border-radius:10px;'
			}
		};
		const axisText = { color: t.text3, fontSize: 11 };

		if (activeView === 'hours') {
			return {
				...base,
				grid: { left: 4, right: 8, top: 16, bottom: 4, containLabel: true },
				tooltip: {
					...base.tooltip,
					trigger: 'axis',
					axisPointer: { type: 'shadow', shadowStyle: { color: alpha(accent, 0.08) } },
					formatter: (p: Array<{ dataIndex: number }>) => {
						const h = hours[p[0].dataIndex];
						const revenue = revenueByHour[h] ?? 0;
						return `<div style="font-weight:650;margin-bottom:4px">${hourLabel(h)} to ${hourLabel(h + 1)}</div>
							<div>${byHour[h].toFixed(1)} orders a day on average</div>
							${revenue > 0 ? `<div style="color:${t.text3}">${formatValue(revenue)} a day on average</div>` : ''}`;
					}
				},
				xAxis: {
					type: 'category',
					data: hours.map(shortHour),
					axisTick: { show: false },
					axisLine: { lineStyle: { color: t.border } },
					axisLabel: { ...axisText, interval: 1 }
				},
				yAxis: { type: 'value', splitNumber: 3, axisLabel: axisText, splitLine: { lineStyle: { color: t.grid, type: 'dashed' } } },
				series: [
					{
						type: 'bar',
						data: hours.map((h) => ({
							value: Number(byHour[h].toFixed(1)),
							itemStyle:
								peakHour && h === peakHour.hour
									? { color: accent, borderRadius: [5, 5, 0, 0] }
									: { color: alpha(accent, t.dark ? 0.72 : 0.56), borderRadius: [5, 5, 0, 0] }
						})),
						barMaxWidth: 22,
						emphasis: { itemStyle: { color: accent } }
					}
				]
			};
		}

		const lookup = new Map(cells.map((c) => [`${c.weekday}:${c.hour}`, c.order_count]));
		const max = Math.max(...cells.map((c) => c.order_count));
		const peak = cells.find((c) => c.order_count === max);
		const points: Array<[number, number, number] | { value: [number, number, number]; itemStyle: { borderColor: string; borderWidth: number } }> = [];
		for (let d = 0; d < 7; d++) {
			hours.forEach((h, x) => {
				const value = lookup.get(`${d}:${h}`) ?? 0;
				const isPeak = peak && peak.weekday === d && peak.hour === h;
				points.push(
					isPeak
						? { value: [x, d, value], itemStyle: { borderColor: t.text2, borderWidth: 1.5 } }
						: [x, d, value]
				);
			});
		}

		return {
			...base,
			grid: { left: 4, right: 8, top: 4, bottom: 4, containLabel: true },
			tooltip: {
				...base.tooltip,
				formatter: (p: { value: [number, number, number] }) => {
					const [x, d, v] = p.value;
					return `<div style="font-weight:650;margin-bottom:4px">${DAY_NAMES[d]}, ${hourLabel(hours[x])} to ${hourLabel(hours[x] + 1)}</div>
						<div><b>${v}</b> ${v === 1 ? 'order' : 'orders'}</div>`;
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
				inRange: { color: [t.surface2, alpha(accent, t.dark ? 0.45 : 0.3), accent] }
			},
			series: [
				{
					type: 'heatmap',
					data: points,
					itemStyle: { borderColor: t.card, borderWidth: 3, borderRadius: 5 },
					emphasis: { itemStyle: { borderColor: t.text2, borderWidth: 1 } }
				}
			]
		};
	}
</script>

<ChartPanel
	title="Busiest times"
	subtitle={hasData ? `${total.toLocaleString('en-IN')} orders in the last ${days} days` : ''}
	extra="rhythm-panel"
>
	{#if loading}
		<div class="frame"><Skeleton height="292px" /></div>
	{:else if !hasData}
		<div class="empty">No orders in this window yet</div>
	{:else}
		<div class="frame">
			<EChart {build} height={292} label={`Orders by ${activeView === 'heatmap' ? 'weekday and hour' : 'hour'}. Busiest ${rush}.`} />
		</div>
	{/if}

	{#snippet footer()}
		{#if rush}<strong>Most orders come in {rush}.</strong>{/if}
		{#if busiestDay}
			{busiestDay.name} is the busiest day.
		{:else if peakHour}
			{hourLabel(peakHour.hour)} is the peak hour at {formatValue(peakHour.revenue)} a day.
		{/if}
	{/snippet}
</ChartPanel>

<style>
	.frame {
		flex: 1;
		padding: 0 0.75rem 0.5rem;
	}

	.empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 292px;
		padding: 0 1rem;
		font-size: var(--fs-body);
		color: var(--text-3);
		text-align: center;
	}
</style>
