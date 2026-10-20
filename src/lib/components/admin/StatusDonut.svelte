<script lang="ts">
	import EChart, { type ChartTokens } from '$lib/components/charts/EChart.svelte';
	import Skeleton from './Skeleton.svelte';
	import type { StatusPoint } from '$lib/tenant/analytics';

	let {
		title = 'Order pipeline',
		data = [] as StatusPoint[],
		loading = false
	}: {
		title?: string;
		data?: StatusPoint[];
		loading?: boolean;
	} = $props();

	/** Workflow order, so the legend reads as a pipeline rather than by volume. */
	const ORDER = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];
	const LABEL: Record<string, string> = {
		PENDING: 'Pending',
		ACCEPTED: 'Accepted',
		PREPARING: 'Preparing',
		READY: 'Ready',
		COMPLETED: 'Completed',
		CANCELLED: 'Cancelled'
	};
	/** Hue keyed to the stage, so a colour always means the same thing. */
	const TINT: Record<string, string> = {
		PENDING: '#d97706',
		ACCEPTED: '#0891b2',
		PREPARING: '#7c3aed',
		READY: '#2563eb',
		COMPLETED: '#059669',
		CANCELLED: '#dc2626'
	};

	const points = $derived(
		[...data]
			.filter((d) => d.count > 0)
			.sort((a, b) => {
				const ai = ORDER.indexOf(a.status);
				const bi = ORDER.indexOf(b.status);
				return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
			})
			.map((d) => ({
				status: d.status,
				label: LABEL[d.status] ?? d.status,
				value: Number(d.count),
				color: TINT[d.status] ?? 'var(--text-3)'
			}))
	);

	const total = $derived(points.reduce((sum, p) => sum + p.value, 0));
	const inFlight = $derived(
		points
			.filter((p) => ['PENDING', 'ACCEPTED', 'PREPARING', 'READY'].includes(p.status))
			.reduce((sum, p) => sum + p.value, 0)
	);

	const cancelled = $derived(points.find((p) => p.status === 'CANCELLED')?.value ?? 0);
	const takeaway = $derived(
		inFlight > 0
			? `${inFlight} ${inFlight === 1 ? 'order is' : 'orders are'} still in progress.`
			: cancelled > 0
				? `All caught up. ${Math.round((cancelled / total) * 100)}% of orders were cancelled.`
				: 'All caught up. Nothing is waiting.'
	);

	function build(t: ChartTokens) {
		return {
			textStyle: { fontFamily: t.font },
			tooltip: {
				trigger: 'item',
				backgroundColor: t.surface,
				borderColor: t.border,
				padding: [8, 12],
				textStyle: { color: t.text, fontSize: 12 },
				extraCssText: 'box-shadow:0 8px 24px rgba(0,0,0,.18);border-radius:8px;',
				formatter: (p: { name: string; value: number; percent: number }) =>
					`${p.name}<br/><b>${p.value}</b> ${p.value === 1 ? 'order' : 'orders'}, ${Math.round(p.percent)}%`
			},
			series: [
				{
					type: 'pie',
					radius: ['68%', '92%'],
					avoidLabelOverlap: false,
					padAngle: points.length > 1 ? 2 : 0,
					itemStyle: { borderRadius: 4 },
					label: { show: false },
					emphasis: { scale: true, scaleSize: 4 },
					data: points.map((p) => ({ name: p.label, value: p.value, itemStyle: { color: p.color } }))
				}
			]
		};
	}
</script>

<section class="panel">
	<div class="head">
		<h3 class="panel-h" style="margin:0;">{title}</h3>
		{#if total > 0}
			<p class="sub">{total} {total === 1 ? 'order' : 'orders'} in this period</p>
		{/if}
	</div>

	{#if loading}
		<div class="body"><Skeleton height="170px" /></div>
	{:else if total === 0}
		<div class="empty">No orders yet</div>
	{:else}
		<div class="body">
			<div class="donut">
				<EChart {build} height={124} label="Orders by status: {inFlight} open of {total}" />
				<div class="centre">
					<strong>{inFlight}</strong>
					<span>open</span>
				</div>
			</div>

			<ul class="legend">
				{#each points as p (p.status)}
					<li>
						<span class="dot" style={`background:${p.color}`}></span>
						<span class="lg-label">{p.label}</span>
						<span class="lg-val">{p.value}</span>
					</li>
				{/each}
				<li class="takeaway">{takeaway}</li>
			</ul>
		</div>
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
	}

	.body {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.4rem 1rem 1rem;
		flex-wrap: wrap;
	}

	.donut {
		position: relative;
		flex: 0 0 124px;
		width: 124px;
		height: 124px;
	}


	.centre {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.05rem;
		pointer-events: none;
	}

	.centre strong {
		font-size: var(--fs-h1);
		font-weight: 600;
		color: var(--text);
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.centre span {
		font-size: var(--fs-code);
		color: var(--text-3);
	}

	.takeaway {
		margin-top: 0.35rem;
		color: var(--text-2);
		font-size: var(--fs-code);
	}

	.legend {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		flex: 1 1 8rem;
		min-width: 0;
	}

	.legend li {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: var(--fs-tab);
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.lg-label {
		color: var(--text-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.lg-val {
		margin-left: auto;
		color: var(--text);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 170px;
		font-size: var(--fs-body);
		color: var(--text-3);
	}
</style>
