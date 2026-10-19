<script lang="ts">
	import Skeleton from '../Skeleton.svelte';

	export type Metric = {
		label: string;
		value: string;
		/** Secondary line: the number's context, not a second KPI. */
		sub?: string;
		/** Change against a comparison period. Colour is the only signal beyond the sign. */
		delta?: { text: string; dir: 'up' | 'down' | 'flat' } | null;
		series?: number[];
		href?: string;
	};

	/**
	 * The headline numbers as one strip, divided by hairlines: the way a billing
	 * or analytics console shows them. No icons, no tiles: a number needs a label
	 * and a comparison, and colour is reserved for the change and the data.
	 */
	let { metrics, loading = false }: { metrics: Metric[]; loading?: boolean } = $props();

	const W = 72;
	const H = 22;
	function path(series: number[]): string {
		if (series.length < 2) return '';
		const max = Math.max(...series, 1);
		const step = W / (series.length - 1);
		return series
			.map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(H - 2 - (v / max) * (H - 4)).toFixed(1)}`)
			.join(' ');
	}
</script>

<section class="panel strip" aria-label="Key figures">
	{#each metrics as m (m.label)}
		<svelte:element this={m.href ? 'a' : 'div'} href={m.href} class={['cell', m.href ? 'link' : ''].join(' ')}>
			<span class="label">{m.label}</span>
			{#if loading}
				<Skeleton height="1.4rem" width="5rem" />
				<Skeleton height="0.7rem" width="8rem" />
			{:else}
				<span class="row">
					<span class="value">{m.value}</span>
					{#if m.series && m.series.length > 1}
						<svg class="spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
							<path d={path(m.series)} />
						</svg>
					{/if}
				</span>
				<span class="sub">
					{#if m.delta}<span class={['delta', m.delta.dir].join(' ')}>{m.delta.text}</span>{/if}
					{#if m.sub}<span>{m.sub}</span>{/if}
				</span>
			{/if}
		</svelte:element>
	{/each}
</section>

<style>
	.strip {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		padding: 0;
		overflow: hidden;
	}

	.cell {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		min-width: 0;
		padding: var(--sp-7) var(--sp-8);
		color: inherit;
		text-decoration: none;
	}

	.cell + .cell {
		border-left: 1px solid var(--border-subtle);
	}

	.cell.link:hover {
		background: var(--surface-hover);
	}

	.label {
		font-size: var(--fs-meta);
		font-weight: 500;
		color: var(--text-3);
	}

	.row {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--sp-6);
	}

	.value {
		font-size: var(--fs-stat);
		font-weight: 600;
		line-height: 1.15;
		letter-spacing: -0.01em;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}

	.spark {
		width: 4.5rem;
		height: 1.4rem;
		flex-shrink: 0;
		margin-bottom: 0.15rem;
	}

	.spark path {
		fill: none;
		stroke: var(--accent);
		stroke-width: 1.4;
		stroke-linejoin: round;
		stroke-linecap: round;
		vector-effect: non-scaling-stroke;
	}

	.sub {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-3);
		font-size: var(--fs-meta);
		color: var(--text-3);
	}

	.delta {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--text-2);
	}

	.delta.up {
		color: var(--success);
	}

	.delta.down {
		color: var(--danger);
	}

	@media (max-width: 900px) {
		.strip {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.cell:nth-child(odd) {
			border-left: 0;
		}

		.cell:nth-child(n + 3) {
			border-top: 1px solid var(--border-subtle);
		}
	}

	@media (max-width: 520px) {
		.strip {
			grid-template-columns: minmax(0, 1fr);
		}

		.cell + .cell {
			border-left: 0;
			border-top: 1px solid var(--border-subtle);
		}
	}
</style>
