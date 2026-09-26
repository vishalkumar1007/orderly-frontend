<script lang="ts">
	import { Chart, Svg, Axis, Spline, Highlight } from 'layerchart';
	import { scaleLinear, scaleTime } from 'd3-scale';
	import Skeleton from './Skeleton.svelte';

	type Point = { day: string; order_count: number };

	let {
		title = '',
		badge = '',
		data = [] as Point[],
		loading = false,
		emptyLabel = 'No data yet'
	}: {
		title?: string;
		/** Scope label, e.g. "All businesses". */
		badge?: string;
		data?: Point[];
		loading?: boolean;
		emptyLabel?: string;
	} = $props();

	const points = $derived(
		data.map((d) => ({ date: new Date(`${d.day}T12:00:00`), value: Number(d.order_count ?? 0) }))
	);
</script>

<section class="panel">
	{#if title || badge}
		<div class="bento-head">
			{#if title}<h3 class="panel-h" style="margin:0;">{title}</h3>{/if}
			{#if badge}<span class="bento-pill">{badge}</span>{/if}
		</div>
	{/if}
	{#if loading}
		<Skeleton height="230px" />
	{:else if points.length === 0}
		<div class="chart-empty">{emptyLabel}</div>
	{:else}
		<div class="chart-frame">
			<Chart
				data={points}
				x="date"
				y="value"
				xScale={scaleTime()}
				yScale={scaleLinear()}
				yDomain={[0, null]}
				padding={{ left: 36, bottom: 28, top: 12, right: 8 }}
			>
				<Svg>
					<Axis placement="left" />
					<Axis placement="bottom" />
					<Spline class="chart-stroke" />
					<Highlight points />
				</Svg>
			</Chart>
		</div>
	{/if}
</section>
