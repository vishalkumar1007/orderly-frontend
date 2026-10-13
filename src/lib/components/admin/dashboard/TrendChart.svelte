<script lang="ts">
	import { scaleLinear } from 'd3-scale';
	import Skeleton from '../Skeleton.svelte';
	import { compact } from './tones';

	type Day = { day: string; order_count: number; revenue: number };

	/**
	 * Orders or sales over the window, as one smooth area with a hover read-out.
	 *
	 * Drawn directly in SVG from the theme's tokens rather than through a chart
	 * library: axis text, grid and fill all follow light / dark / soft and the
	 * accent, and the hover is ours to place. Switching metric changes the colour
	 * as well as the numbers, so you can tell which one you are looking at without
	 * reading the toggle.
	 */
	let {
		data = [] as Day[],
		loading = false,
		money = (n: number) => String(n)
	}: { data?: Day[]; loading?: boolean; money?: (n: number) => string } = $props();

	type Metric = 'orders' | 'sales';
	let metric = $state<Metric>('orders');

	let width = $state(640);
	let frameH = $state(250);
	// Grows with the row it sits in, so a taller neighbour never leaves a gap.
	const H = $derived(Math.max(frameH, 250));
	const PAD = { l: 44, r: 12, t: 14, b: 26 };

	const values = $derived(data.map((d) => (metric === 'orders' ? d.order_count : d.revenue)));
	const hasData = $derived(values.some((v) => v > 0));
	const total = $derived(values.reduce((a, b) => a + b, 0));
	const peakIdx = $derived(values.length ? values.indexOf(Math.max(...values)) : 0);
	const fmt = (n: number) => (metric === 'orders' ? String(Math.round(n)) : money(n));

	const x = $derived(
		scaleLinear()
			.domain([0, Math.max(values.length - 1, 1)])
			.range([PAD.l, width - PAD.r])
	);
	const y = $derived(
		scaleLinear()
			.domain([0, Math.max(...values, 1)])
			.nice(4)
			.range([H - PAD.b, PAD.t])
	);
	const yTicks = $derived(y.ticks(4));

	/** Monotone cubic through the points: smooth, and never overshoots below zero. */
	function smooth(pts: [number, number][]): string {
		const n = pts.length;
		if (n < 2) return '';
		const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0]);
		const m = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / dx[i]);
		const t = [m[0]];
		for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
		t.push(m[n - 2]);
		for (let i = 0; i < n - 1; i++) {
			if (m[i] === 0) {
				t[i] = 0;
				t[i + 1] = 0;
				continue;
			}
			const a = t[i] / m[i];
			const b = t[i + 1] / m[i];
			const s = a * a + b * b;
			if (s > 9) {
				const k = 3 / Math.sqrt(s);
				t[i] = k * a * m[i];
				t[i + 1] = k * b * m[i];
			}
		}
		let d = `M${pts[0][0]},${pts[0][1]}`;
		for (let i = 0; i < n - 1; i++) {
			const h = dx[i] / 3;
			d += ` C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
		}
		return d;
	}

	const pts = $derived(values.map((v, i) => [x(i), y(v)] as [number, number]));
	const line = $derived(smooth(pts));
	const area = $derived(
		pts.length ? `${line} L${pts[pts.length - 1][0]},${H - PAD.b} L${pts[0][0]},${H - PAD.b} Z` : ''
	);

	const label = (iso: string) =>
		new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
	const xTicks = $derived(
		data.map((d, i) => ({ i, text: label(d.day) })).filter((_, i, a) => i % Math.ceil(a.length / 6) === 0)
	);

	let hover = $state<number | null>(null);
	function move(e: PointerEvent) {
		const box = (e.currentTarget as SVGElement).getBoundingClientRect();
		const px = ((e.clientX - box.left) / box.width) * width;
		const i = Math.round(x.invert(px));
		hover = Math.min(Math.max(i, 0), values.length - 1);
	}
	const tipLeft = $derived(hover === null ? 0 : (x(hover) / width) * 100);
</script>

<section class="panel card">
	<header class="head">
		<div>
			<h3>{metric === 'orders' ? 'Orders' : 'Sales'}</h3>
			<p class="sum">
				{#if loading}
					&nbsp;
				{:else}
					<strong>{fmt(total)}</strong> over the last {data.length || 30} days
					{#if hasData}· peak {fmt(values[peakIdx])} on {label(data[peakIdx].day)}{/if}
				{/if}
			</p>
		</div>
		<div class="tabs" role="radiogroup" aria-label="Metric">
			<button type="button" role="radio" aria-checked={metric === 'orders'} onclick={() => (metric = 'orders')}>Orders</button>
			<button type="button" role="radio" aria-checked={metric === 'sales'} onclick={() => (metric = 'sales')}>Sales</button>
		</div>
	</header>

	{#if loading}
		<Skeleton height={`${H}px`} />
	{:else if !hasData}
		<div class="empty" style={`height:${H}px`}>
			<strong>No {metric === 'orders' ? 'orders' : 'sales'} in this window yet</strong>
			<span>It fills in as businesses start taking orders.</span>
		</div>
	{:else}
		<div class="frame" bind:clientWidth={width} bind:clientHeight={frameH}>
			<svg viewBox={`0 0 ${width} ${H}`} width="100%" height="100%" role="img" aria-label={`${metric} per day`} onpointermove={move} onpointerleave={() => (hover = null)}>
				{#each yTicks as t (t)}
					<line class="grid" x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} />
					<text class="tick" x={PAD.l - 8} y={y(t)} text-anchor="end" dominant-baseline="middle">
						{compact(t)}
					</text>
				{/each}
				{#each xTicks as t (t.i)}
					<text class="tick" x={x(t.i)} y={H - 6} text-anchor="middle">{t.text}</text>
				{/each}
				<path d={area} class="area" />
				<path d={line} class="stroke" />
				{#if hover !== null}
					<line class="rule" x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} />
					<circle class="dot" cx={x(hover)} cy={y(values[hover])} r="3.5" />
				{/if}
			</svg>
			{#if hover !== null}
				<div class="tip" style={`left:${tipLeft}%`} class:flip={tipLeft > 70}>
					<span>{label(data[hover].day)}</span>
					<strong>{fmt(values[hover])}</strong>
				</div>
			{/if}
		</div>
	{/if}
</section>

<style>
	.card {
		display: flex;
		flex-direction: column;
		min-width: 0;
		overflow: hidden;
	}

	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--sp-6);
		flex-wrap: wrap;
		margin-bottom: var(--sp-5);
	}

	h3 {
		margin: 0;
		font-size: var(--fs-body);
		font-weight: 600;
		color: var(--text);
	}

	.sum {
		margin: var(--sp-1) 0 0;
		font-size: var(--fs-meta);
		color: var(--text-3);
	}

	.sum strong {
		color: var(--text);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.tabs {
		display: inline-flex;
		gap: var(--sp-1);
	}

	.tabs button {
		padding: var(--sp-2) var(--sp-5);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		font: inherit;
		font-size: var(--fs-tab);
		font-weight: 500;
		color: var(--text-3);
		cursor: default;
		transition: background 0.1s, color 0.1s;
	}

	.tabs button:hover {
		color: var(--text);
		background: var(--surface-hover);
	}

	.tabs button[aria-checked='true'] {
		color: var(--accent);
		background: color-mix(in srgb, var(--accent) 14%, transparent);
	}

	.frame {
		position: relative;
		flex: 1;
		width: 100%;
		min-height: 250px;
	}

	svg {
		display: block;
		position: absolute;
		inset: 0;
		max-width: 100%;
		touch-action: pan-y;
	}

	.grid {
		stroke: var(--border-subtle);
	}

	.tick {
		fill: var(--text-3);
		font-size: 11px;
		font-family: inherit;
		font-variant-numeric: tabular-nums;
	}

	.area {
		fill: color-mix(in srgb, var(--accent) 8%, transparent);
	}

	.stroke {
		fill: none;
		stroke: var(--accent);
		stroke-width: 1.6;
		stroke-linecap: round;
	}

	.rule {
		stroke: var(--border);
		stroke-width: 1;
	}

	.dot {
		fill: var(--card-bg);
		stroke: var(--accent);
		stroke-width: 1.8;
	}

	.tip {
		position: absolute;
		top: 4px;
		transform: translateX(10px);
		display: flex;
		flex-direction: column;
		padding: var(--sp-3) var(--sp-5);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--card-bg);
		box-shadow: var(--shadow-sm);
		pointer-events: none;
		font-size: var(--fs-meta);
		color: var(--text-3);
		white-space: nowrap;
	}

	.tip.flip {
		transform: translateX(calc(-100% - 10px));
	}

	.tip strong {
		color: var(--text);
		font-size: var(--fs-body);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--sp-2);
		color: var(--text-3);
		font-size: var(--fs-meta);
	}

	.empty strong {
		color: var(--text-2);
		font-size: var(--fs-body);
		font-weight: 500;
	}
</style>
