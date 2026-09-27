<script lang="ts">
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

	/**
	 * Donut segments are drawn as stroked circles rather than SVG arc paths.
	 * `stroke-dasharray` gives a gap between segments and rounded ends for free,
	 * and the maths stays a single dash offset per segment.
	 */
	const RADIUS = 42;
	const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
	/** Gap between segments, in units of the circumference. */
	const GAP = 2.5;

	const segments = $derived.by(() => {
		if (total <= 0) return [];
		let consumed = 0;
		return points.map((p) => {
			const share = p.value / total;
			const length = share * CIRCUMFERENCE;
			const segment = {
				...p,
				share,
				// Leave a gap on every segment except a full-circle one.
				dash: Math.max(length - GAP, 0.5),
				offset: -consumed * CIRCUMFERENCE
			};
			consumed += share;
			return segment;
		});
	});
</script>

<section class="panel">
	<div class="head">
		<h3 class="panel-h" style="margin:0;">{title}</h3>
		{#if total > 0}
			<p class="sub">{inFlight} open · {total} total</p>
		{/if}
	</div>

	{#if loading}
		<div class="body"><Skeleton height="170px" /></div>
	{:else if total === 0}
		<div class="empty">No orders yet</div>
	{:else}
		<div class="body">
			<div class="donut">
				<svg viewBox="0 0 120 120" role="img" aria-label="Orders by status">
					{#each segments as seg (seg.status)}
						<circle
							cx="60"
							cy="60"
							r={RADIUS}
							fill="none"
							stroke={seg.color}
							stroke-width="18"
							stroke-dasharray={`${seg.dash} ${CIRCUMFERENCE - seg.dash}`}
							stroke-dashoffset={seg.offset}
							transform="rotate(-90 60 60)"
						/>
					{/each}
				</svg>
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
		font-size: 0.9rem;
		font-weight: 600;
	}

	.sub {
		margin: 0;
		font-size: 0.74rem;
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

	.donut svg {
		width: 100%;
		height: 100%;
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
		font-size: 1.35rem;
		font-weight: 600;
		color: var(--text);
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.centre span {
		font-size: 0.68rem;
		color: var(--text-3);
		text-transform: uppercase;
		letter-spacing: 0.05em;
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
		font-size: 0.78rem;
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
		font-size: 0.82rem;
		color: var(--text-3);
	}
</style>
