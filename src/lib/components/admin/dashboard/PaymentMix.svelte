<script lang="ts">
	import EChart, { alpha, darken, type ChartTokens } from '$lib/components/charts/EChart.svelte';
	import type { PaymentPoint } from '$lib/tenant/analytics';
	import Skeleton from '../Skeleton.svelte';
	import ChartPanel from './ChartPanel.svelte';

	/**
	 * How customers paid, merged by method. A donut answers the share question
	 * at a glance; the rows carry the counts and money behind each slice.
	 * Slices are steps of the theme accent, largest first, so the panel never
	 * turns into a rainbow; only "no payment recorded" stays neutral.
	 */
	let {
		data = [] as PaymentPoint[],
		money = (n: number) => String(n),
		loading = false
	}: {
		data?: PaymentPoint[];
		money?: (n: number) => string;
		loading?: boolean;
	} = $props();

	/** Accent strength for each rank, strongest first. */
	const STEPS = [1, 0.62, 0.38, 0.22];

	function label(method: string): string {
		switch (method) {
			case 'ONLINE':
				return 'Online';
			case 'ONLINE_TEST':
				return 'Online (test)';
			case 'CASH':
				return 'Cash';
			case 'UNRECORDED':
				return 'No payment recorded';
			default:
				return method.charAt(0) + method.slice(1).toLowerCase();
		}
	}

	const methods = $derived.by(() => {
		const map = new Map<string, { method: string; count: number; revenue: number }>();
		for (const row of data) {
			const current = map.get(row.method) ?? { method: row.method, count: 0, revenue: 0 };
			current.count += Number(row.order_count ?? 0);
			current.revenue += Number(row.revenue ?? 0);
			map.set(row.method, current);
		}
		const total = [...map.values()].reduce((sum, m) => sum + m.count, 0);
		return [...map.values()]
			.sort((a, b) => b.count - a.count)
			.map((m, i) => ({
				...m,
				label: label(m.method),
				step: STEPS[Math.min(i, STEPS.length - 1)],
				neutral: m.method === 'UNRECORDED',
				share: total > 0 ? (m.count / total) * 100 : 0
			}));
	});

	const totalOrders = $derived(methods.reduce((sum, m) => sum + m.count, 0));
	const totalRevenue = $derived(methods.reduce((sum, m) => sum + m.revenue, 0));
	const top = $derived(methods[0] ?? null);

	/** The row dot, matching its slice. */
	const dot = (m: (typeof methods)[number]) =>
		m.neutral
			? 'var(--text-3)'
			: `color-mix(in srgb, color-mix(in srgb, var(--accent) 86%, #000) ${Math.round(m.step * 100)}%, transparent)`;

	function build(t: ChartTokens) {
		const base = darken(t.accent, t.dark ? 0.06 : 0.14);
		return {
			textStyle: { fontFamily: t.font },
			tooltip: {
				trigger: 'item',
				backgroundColor: t.card,
				borderColor: t.border,
				padding: [9, 12],
				textStyle: { color: t.text, fontSize: 12 },
				extraCssText: 'box-shadow:0 10px 28px rgba(0,0,0,.18);border-radius:10px;',
				formatter: (p: { name: string; value: number; percent: number }) =>
					`<div style="font-weight:650;margin-bottom:4px">${p.name}</div>
					 <div>${p.value} orders, ${Math.round(p.percent)}%</div>`
			},
			series: [
				{
					type: 'pie',
					radius: ['68%', '94%'],
					center: ['50%', '50%'],
					startAngle: 90,
					avoidLabelOverlap: false,
					label: { show: false },
					labelLine: { show: false },
					itemStyle: { borderColor: t.card, borderWidth: 3, borderRadius: 4 },
					emphasis: { scale: true, scaleSize: 3 },
					data: methods.map((m) => ({
						name: m.label,
						value: m.count,
						itemStyle: { color: m.neutral ? t.text3 : alpha(base, m.step) }
					}))
				}
			]
		};
	}
</script>

<ChartPanel
	title="How customers paid"
	subtitle={totalOrders > 0 ? `${money(totalRevenue)} collected` : ''}
	extra="pay-panel"
>
	{#if loading}
		<div class="pad"><Skeleton height="260px" /></div>
	{:else if methods.length === 0}
		<div class="empty">No completed orders in this period yet</div>
	{:else}
		<div class="pad">
			<div class="donut">
				<EChart {build} height={168} label="Payment methods by share of orders" />
				<div class="donut-centre" aria-hidden="true">
					<strong>{totalOrders.toLocaleString('en-IN')}</strong>
					<span>orders</span>
				</div>
			</div>

			<ul class="rows">
				{#each methods.slice(0, 4) as m (m.method)}
					<li>
						<span class="dot" style={`background:${dot(m)}`}></span>
						<span class="method">{m.label}</span>
						<span class="money">{money(m.revenue)}</span>
						<strong class="share">{Math.round(m.share)}%</strong>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#snippet footer()}
		{#if top && totalOrders > 0}
			<strong>{top.label}</strong> is the most used method, at {Math.round(top.share)}% of orders.
		{:else}
			Payment methods are configured under <a href="/shop/payments">Payments</a>.
		{/if}
	{/snippet}
</ChartPanel>

<style>
	.pad {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 1.25rem;
		padding: 0.5rem 1.25rem 1.25rem;
	}

	.donut {
		position: relative;
		width: 168px;
		margin: 0 auto;
	}

	.donut-centre {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.1rem;
		pointer-events: none;
	}

	.donut-centre strong {
		font-family: var(--font-display);
		font-size: var(--fs-stat);
		font-weight: 650;
		line-height: 1;
		letter-spacing: -0.02em;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}

	.donut-centre span {
		font-size: var(--fs-label);
		color: var(--text-3);
	}

	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	.rows li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-width: 0;
		padding: 0.55rem 0;
		border-top: 1px solid var(--border-subtle);
		font-size: var(--fs-code);
		font-variant-numeric: tabular-nums;
	}

	.rows li:first-child {
		border-top: 0;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 2px;
		flex: none;
	}

	.method {
		flex: 1;
		min-width: 0;
		font-weight: 550;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.money {
		color: var(--text-3);
		white-space: nowrap;
	}

	.share {
		width: 2.6rem;
		text-align: right;
		font-weight: 650;
		color: var(--text);
	}

	.empty {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 260px;
		padding: 0 1.25rem;
		text-align: center;
		font-size: var(--fs-body);
		color: var(--text-3);
	}
</style>
