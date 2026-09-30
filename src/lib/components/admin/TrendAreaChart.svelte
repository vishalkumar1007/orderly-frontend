<script lang="ts">
	import { Chart, Svg, Axis, Area, Spline, Highlight } from 'layerchart';
	import { scaleLinear, scaleTime } from 'd3-scale';
	import Skeleton from './Skeleton.svelte';
	import type { DayPoint } from '$lib/tenant/analytics';

	type Metric = 'revenue' | 'orders';

	let {
		title = 'Performance',
		data = [] as DayPoint[],
		loading = false,
		formatValue = (n: number) => String(n),
		emptyLabel = 'No orders in this window'
	}: {
		title?: string;
		data?: DayPoint[];
		loading?: boolean;
		formatValue?: (n: number) => string;
		emptyLabel?: string;
	} = $props();

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
	const peak = $derived(points.length ? Math.max(...points.map((p) => p[active]), 0) : 0);
	const total = $derived(points.reduce((sum, p) => sum + p[active], 0));
	const average = $derived(points.length ? total / points.length : 0);

	const summary = $derived(
		active === 'revenue'
			? `${formatValue(total)} total · ${formatValue(average)} daily average`
			: `${total} orders · ${average.toFixed(1)} per day`
	);
</script>

<section class="panel">
	<div class="head">
		<div>
			<h3 class="panel-h" style="margin:0;">{title}</h3>
			<p class="sub">{summary}</p>
		</div>
		<div class="toggle" role="tablist" aria-label="Metric">
			<button
				type="button"
				role="tab"
				aria-selected={active === 'revenue'}
				class:active={active === 'revenue'}
				onclick={() => (active = 'revenue')}>Revenue</button
			>
			<button
				type="button"
				role="tab"
				aria-selected={active === 'orders'}
				class:active={active === 'orders'}
				onclick={() => (active = 'orders')}>Orders</button
			>
		</div>
	</div>

	{#if loading}
		<div class="frame"><Skeleton height="230px" /></div>
	{:else if !hasData}
		<div class="empty">{emptyLabel}</div>
	{:else}
		<div class="frame" class:orders={active === 'orders'}>
			<Chart
				data={points}
				x="date"
				y={active}
				xScale={scaleTime()}
				yScale={scaleLinear()}
				yDomain={[0, null]}
				padding={{ left: 40, bottom: 28, top: 12, right: 10 }}
			>
				<Svg>
					<Axis placement="left" />
					<Axis placement="bottom" />
					<Area class="trend-fill" />
					<Spline class="trend-stroke" />
					<Highlight points={false} />
				</Svg>
			</Chart>
		</div>
		<p class="foot">
			Peak {active === 'revenue' ? formatValue(peak) : `${peak} orders`}
			{active === 'revenue' ? 'in a single day' : 'in a single day'}
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

	.frame {
		height: 230px;
		padding: 0 0.75rem;
	}

	.frame :global(.trend-fill) {
		fill: color-mix(in srgb, var(--accent) 14%, transparent);
	}

	.frame :global(.trend-stroke) {
		stroke: var(--accent);
		stroke-width: 2;
		fill: none;
	}

	/* Orders use a second hue so switching the metric is visible at a glance. */
	.frame.orders :global(.trend-fill) {
		fill: color-mix(in srgb, var(--accent-2) 16%, transparent);
	}

	.frame.orders :global(.trend-stroke) {
		stroke: var(--accent-2);
	}

	.empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 230px;
		font-size: var(--fs-body);
		color: var(--text-3);
	}

	.foot {
		margin: 0;
		padding: 0.1rem 1rem 0.85rem;
		font-size: var(--fs-code);
		color: var(--text-3);
	}
</style>
