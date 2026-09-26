<script lang="ts">
	import { Chart, Svg, Axis, Bars } from 'layerchart';
	import { scaleBand, scaleLinear } from 'd3-scale';
	import Skeleton from './Skeleton.svelte';

	type Point = { label: string; value: number };

	let {
		title = '',
		badge = '',
		data = [] as Point[],
		loading = false,
		formatValue = (n: number) => String(n),
		emptyLabel = 'No data in this window'
	}: {
		title?: string;
		badge?: string;
		data?: Point[];
		loading?: boolean;
		formatValue?: (n: number) => string;
		emptyLabel?: string;
	} = $props();

	const max = $derived(Math.max(...data.map((d) => d.value), 1));
</script>

<section class="panel">
	{#if title || badge}
		<div class="bento-head">
			{#if title}<h3 class="panel-h" style="margin:0;">{title}</h3>{/if}
			{#if badge}<span class="bento-pill">{badge}</span>{/if}
		</div>
	{/if}

	{#if loading}
		<Skeleton height="200px" />
	{:else if data.length === 0}
		<div class="chart-empty">{emptyLabel}</div>
	{:else}
		<div class="chart-frame" style="height:200px;">
			<Chart
				data={data}
				x="label"
				y="value"
				xScale={scaleBand().padding(0.28)}
				yScale={scaleLinear()}
				yDomain={[0, null]}
				padding={{ left: 46, bottom: 26, top: 10, right: 8 }}
			>
				<Svg>
					<Axis placement="left" />
					<Axis placement="bottom" />
					<Bars class="chart-bar" radius={3} />
				</Svg>
			</Chart>
		</div>
		<p class="series-foot">
			Peak {formatValue(max)}
		</p>
	{/if}
</section>

<style>
	.series-foot {
		margin: 0.5rem 0 0;
		padding-top: 0.6rem;
		border-top: 1px solid var(--border-subtle);
		font-size: 0.76rem;
		color: var(--text-3);
	}
</style>
