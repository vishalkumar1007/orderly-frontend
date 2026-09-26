<script lang="ts">
	import { Chart, Svg, Axis, Bars } from 'layerchart';
	import { scaleBand, scaleLinear } from 'd3-scale';
	import Skeleton from './Skeleton.svelte';

	type Point = { week_start: string; tenant_count: number };

	let {
		title = '',
		data = [] as Point[],
		loading = false,
		emptyLabel = 'No data yet'
	}: {
		title?: string;
		data?: Point[];
		loading?: boolean;
		emptyLabel?: string;
	} = $props();

	const points = $derived(
		data.map((d) => ({
			label: d.week_start ? d.week_start.slice(5) : '',
			value: Number(d.tenant_count ?? 0)
		}))
	);
</script>

<section class="panel">
	{#if title}<h3 class="panel-h">{title}</h3>{/if}
	{#if loading}
		<Skeleton height="230px" />
	{:else if points.length === 0}
		<div class="chart-empty">{emptyLabel}</div>
	{:else}
		<div class="chart-frame">
			<Chart
				data={points}
				x="label"
				y="value"
				xScale={scaleBand().padding(0.3)}
				yScale={scaleLinear()}
				yDomain={[0, null]}
				padding={{ left: 36, bottom: 28, top: 12, right: 8 }}
			>
				<Svg>
					<Axis placement="left" />
					<Axis placement="bottom" />
					<Bars class="chart-bar" radius={4} />
				</Svg>
			</Chart>
		</div>
	{/if}
</section>
