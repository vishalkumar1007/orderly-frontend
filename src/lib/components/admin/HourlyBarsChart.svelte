<script lang="ts">
	import { Chart, Svg, Axis, Bars } from 'layerchart';
	import { scaleBand, scaleLinear } from 'd3-scale';
	import Skeleton from './Skeleton.svelte';
	import type { HourPoint } from '$lib/tenant/analytics';

	let {
		title = 'Busiest hours',
		data = [] as HourPoint[],
		loading = false,
		emptyLabel = 'No orders in this window'
	}: {
		title?: string;
		data?: HourPoint[];
		loading?: boolean;
		emptyLabel?: string;
	} = $props();

	/**
	 * Twenty-four bars is unreadable in a half-width panel, and the hours a shop
	 * is shut tell a manager nothing. Four service-period buckets carry the
	 * signal and still show overnight trade.
	 */
	const BUCKETS = [
		{ label: '12–6a', from: 0, to: 6 },
		{ label: '6–12a', from: 6, to: 12 },
		{ label: '12–5p', from: 12, to: 17 },
		{ label: '5–12a', from: 17, to: 24 }
	];

	const points = $derived(
		BUCKETS.map((b) => ({
			label: b.label,
			value: data
				.filter((p) => p.hour >= b.from && p.hour < b.to)
				.reduce((sum, p) => sum + Number(p.order_count ?? 0), 0)
		}))
	);

	const hasData = $derived(points.some((p) => p.value > 0));
	const busiest = $derived(points.reduce((best, p) => (p.value > best.value ? p : best), points[0]));
</script>

<section class="panel">
	<div class="head">
		<h3 class="panel-h" style="margin:0;">{title}</h3>
		{#if hasData && busiest.value > 0}
			<p class="sub">Busiest is {busiest.label}</p>
		{/if}
	</div>

	{#if loading}
		<div class="frame"><Skeleton height="190px" /></div>
	{:else if !hasData}
		<div class="empty">{emptyLabel}</div>
	{:else}
		<div class="frame">
			<Chart
				data={points}
				x="label"
				y="value"
				xScale={scaleBand().padding(0.3)}
				yScale={scaleLinear()}
				yDomain={[0, null]}
				padding={{ left: 34, bottom: 28, top: 12, right: 10 }}
			>
				<Svg>
					<Axis placement="left" />
					<Axis placement="bottom" />
					<Bars class="hour-bar" radius={4} />
				</Svg>
			</Chart>
		</div>
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
		padding: 0.9rem 1rem 0.4rem;
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

	.frame {
		height: 190px;
		padding: 0 0.75rem;
	}

	.frame :global(.hour-bar) {
		fill: color-mix(in srgb, var(--accent) 82%, white);
	}

	.empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 190px;
		font-size: 0.82rem;
		color: var(--text-3);
	}
</style>
