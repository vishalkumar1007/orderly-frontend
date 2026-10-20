<script lang="ts">
	import Skeleton from '../Skeleton.svelte';

	export type Pulse = {
		label: string;
		value: string;
		/** One line of context: where the number came from. */
		hint: string;
		/** Change against the previous period, when one can be compared. */
		trend?: { pct: number; dir: 'up' | 'down' | 'flat'; label: string } | null;
		/** The same series the chart draws, reduced to a sparkline. */
		series?: number[];
		/** Two parts of one whole, drawn as a split bar instead of a sparkline. */
		split?: [{ label: string; value: number }, { label: string; value: number }];
		/** Sparkline shape: a line for money, bars for a count. */
		spark?: 'line' | 'bars';
		/** The first card carries the accent so the strip has a headline. */
		lead?: boolean;
	};

	/**
	 * The dashboard's four headline figures. One strip, one row of hairlines:
	 * the numbers read as a single sentence before the charts explain them.
	 */
	let {
		items = [] as Pulse[],
		loading = false
	}: { items?: Pulse[]; loading?: boolean } = $props();

	const W = 100;
	const H = 30;

	/** A sparkline against its own peak: shape, not scale, is the message. */
	function line(values: number[]): string {
		if (values.length < 2) return '';
		const max = Math.max(...values, 1);
		const step = W / (values.length - 1);
		return values
			.map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(H - 2 - (v / max) * (H - 4)).toFixed(1)}`)
			.join(' ');
	}

	function area(values: number[]): string {
		const path = line(values);
		return path ? `${path} L${W},${H} L0,${H} Z` : '';
	}

	/** Bars for a count series: each day gets an equal slot. */
	function bars(values: number[]) {
		const max = Math.max(...values, 1);
		const step = W / Math.max(values.length, 1);
		const width = Math.max(step * 0.55, 1);
		return values.map((v, i) => {
			const height = v > 0 ? Math.max((v / max) * (H - 2), 1.5) : 0;
			return {
				x: i * step + (step - width) / 2,
				y: H - height,
				width,
				height
			};
		});
	}
</script>

<section class="pulse" aria-label="Key figures">
	{#each items as item (item.label)}
		<div class={['cell', item.lead ? 'lead' : ''].join(' ')}>
			<div class="top">
				<span class="label">{item.label}</span>
				{#if !loading && item.trend}
					<span class={['trend', item.trend.dir].join(' ')} title={item.trend.label}>
						{item.trend.dir === 'up' ? '↑' : item.trend.dir === 'down' ? '↓' : '→'}
						{item.trend.pct}%
					</span>
				{/if}
			</div>

			{#if loading}
				<Skeleton height="1.55rem" width="65%" />
				<Skeleton height="0.7rem" width="85%" />
				<div class="visual"><Skeleton height="30px" /></div>
			{:else}
				<span class="value">{item.value}</span>
				<span class="hint">{item.hint}</span>

				{#if item.split}
					{@const sum = item.split[0].value + item.split[1].value}
					<div class="visual split" aria-hidden="true">
						<span class="split-bar">
							{#if sum > 0}
								<i style={`width:${(item.split[0].value / sum) * 100}%`}></i>
								<i style={`width:${(item.split[1].value / sum) * 100}%`}></i>
							{/if}
						</span>
						<span class="split-legend">
							{#each item.split as part, i (part.label)}
								<span><b class={`key k${i}`}></b>{part.label} {part.value.toLocaleString('en-IN')}</span>
							{/each}
						</span>
					</div>
				{:else if item.series && item.series.length > 1}
					<svg class="visual spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
						{#if item.spark === 'bars'}
							{#each bars(item.series) as bar, i (i)}
								<rect class="spark-bar" x={bar.x} y={bar.y} width={bar.width} height={bar.height} rx="1" />
							{/each}
						{:else}
							<path class="spark-area" d={area(item.series)} />
							<path class="spark-line" d={line(item.series)} />
						{/if}
					</svg>
				{/if}
			{/if}
		</div>
	{/each}
</section>

<style>
	.pulse {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--card-bg);
		overflow: hidden;
	}

	.cell {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		min-width: 0;
		padding: 1.1rem 1.25rem 1rem;
		overflow: hidden;
	}

	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		min-height: 1.35rem;
	}

	.cell + .cell {
		border-left: 1px solid var(--border-subtle);
	}

	.cell.lead {
		background:
			radial-gradient(120% 150% at 0% 0%, color-mix(in srgb, var(--accent) 9%, transparent) 0%, transparent 62%),
			var(--card-bg);
	}

	.cell.lead::before {
		content: '';
		position: absolute;
		inset: 0 auto 0 0;
		width: 2px;
		background: linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent-2) 70%, transparent));
	}

	.label {
		font-size: var(--fs-meta);
		font-weight: 550;
		color: var(--text-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.value {
		font-family: var(--font-display);
		font-size: var(--fs-stat);
		font-weight: 650;
		line-height: 1.12;
		letter-spacing: -0.02em;
		color: var(--text);
		font-variant-numeric: tabular-nums;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.trend {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 0.15rem;
		padding: 0.1rem 0.45rem;
		border-radius: 999px;
		font-size: var(--fs-label);
		font-weight: 650;
		font-variant-numeric: tabular-nums;
		cursor: default;
	}

	.trend.up {
		color: var(--success);
		background: color-mix(in srgb, var(--success) 12%, transparent);
	}

	.trend.down {
		color: var(--danger);
		background: color-mix(in srgb, var(--danger) 12%, transparent);
	}

	.trend.flat {
		color: var(--text-3);
		background: var(--surface-2);
	}

	.hint {
		font-size: var(--fs-code);
		color: var(--text-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Every tile ends on a 30px visual, so the strip's bottom edge is one line. */
	.visual {
		display: block;
		width: 100%;
		height: 30px;
		margin-top: auto;
	}

	.hint {
		margin-bottom: 0.5rem;
	}

	.spark {
		overflow: visible;
	}

	.split {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		gap: 0.45rem;
	}

	.split-bar {
		display: flex;
		gap: 2px;
		height: 8px;
		border-radius: 999px;
		overflow: hidden;
		background: var(--surface-2);
	}

	.split-bar i:first-child,
	.key.k0 {
		background: color-mix(in srgb, var(--accent) 86%, #000);
	}

	.split-bar i:last-child,
	.key.k1 {
		background: color-mix(in srgb, var(--accent) 35%, transparent);
	}

	.split-legend {
		display: flex;
		gap: 0.85rem;
		font-size: var(--fs-label);
		color: var(--text-3);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.split-legend span {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}

	.key {
		width: 7px;
		height: 7px;
		border-radius: 2px;
	}

	.spark-line {
		fill: none;
		stroke: color-mix(in srgb, var(--accent) 86%, #000);
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
		vector-effect: non-scaling-stroke;
	}

	.spark-area {
		fill: color-mix(in srgb, var(--accent) 10%, transparent);
		stroke: none;
	}

	.spark-bar {
		fill: color-mix(in srgb, var(--accent) 62%, transparent);
	}

	@media (max-width: 980px) {
		.pulse {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.cell:nth-child(odd) {
			border-left: 0;
		}

		.cell:nth-child(n + 3) {
			border-top: 1px solid var(--border-subtle);
		}
	}

	@media (max-width: 560px) {
		.pulse {
			grid-template-columns: minmax(0, 1fr);
		}

		.cell + .cell {
			border-left: 0;
			border-top: 1px solid var(--border-subtle);
		}
	}
</style>
