<script lang="ts">
	import Skeleton from '../Skeleton.svelte';
	import ChartPanel from './ChartPanel.svelte';

	/**
	 * How service felt, not how much was sold. The ring is the headline: of the
	 * orders that finished, how many were served rather than cancelled. The two
	 * timings under it say how quickly the shop got there.
	 */
	let {
		medianPrep = 0,
		avgPrep = 0,
		avgAccept = 0,
		fulfilment = null as number | null,
		cancellationRate = 0,
		completed = 0,
		cancelled = 0,
		loading = false
	}: {
		medianPrep?: number;
		avgPrep?: number;
		avgAccept?: number;
		fulfilment?: number | null;
		cancellationRate?: number;
		completed?: number;
		cancelled?: number;
		loading?: boolean;
	} = $props();

	function minutes(value: number | undefined): string {
		if (!value || value <= 0) return '-';
		if (value < 1) return '< 1 min';
		if (value < 60) return `${Math.round(value)} min`;
		const hours = Math.floor(value / 60);
		const minutes = Math.round(value % 60);
		return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
	}

	const finished = $derived(completed + cancelled);

	/** Ring geometry: one circle, the served share drawn as its stroke. */
	const R = 52;
	const C = 2 * Math.PI * R;
	const served = $derived(finished > 0 ? completed / finished : 0);
</script>

<ChartPanel
	title="Order health"
	subtitle={finished > 0 ? `${finished.toLocaleString('en-IN')} orders finished in this period` : 'No finished orders yet'}
	extra="quality-panel"
>
	{#if loading}
		<div class="pad"><Skeleton height="260px" /></div>
	{:else}
		<div class="pad">
			<div class="ring-row">
				<div
					class="ring"
					role="img"
					aria-label={fulfilment == null ? 'No finished orders yet' : `${fulfilment}% of finished orders served`}
				>
					<svg viewBox="0 0 120 120" aria-hidden="true">
						<circle class="ring-track" cx="60" cy="60" r={R} />
						{#if finished > 0}
							<circle class="ring-bad" cx="60" cy="60" r={R} />
							<circle
								class="ring-good"
								cx="60"
								cy="60"
								r={R}
								stroke-dasharray={`${C * served} ${C}`}
							/>
						{/if}
					</svg>
					<div class="ring-centre">
						<strong>{fulfilment == null ? '-' : `${fulfilment}%`}</strong>
						<span>served</span>
					</div>
				</div>

				<ul class="legend">
					<li>
						<i class="key good"></i>
						<span class="legend-label">Completed</span>
						<strong>{completed.toLocaleString('en-IN')}</strong>
					</li>
					<li>
						<i class="key bad"></i>
						<span class="legend-label">Cancelled</span>
						<strong>{cancelled.toLocaleString('en-IN')}</strong>
					</li>
					<li class="rate" class:warn={cancellationRate > 5}>
						{cancellationRate}% cancellation rate
					</li>
				</ul>
			</div>

			<dl class="timings">
				<div>
					<dt>Typical prep</dt>
					<dd>{minutes(medianPrep)}</dd>
					<p>{medianPrep > 0 && avgPrep > 0 ? `Average ${minutes(avgPrep)}` : 'Accepted to ready'}</p>
				</div>
				<div>
					<dt>Time to accept</dt>
					<dd>{minutes(avgAccept)}</dd>
					<p>Order to accepted</p>
				</div>
			</dl>
		</div>
	{/if}

	{#snippet footer()}
		Served share counts orders that finished, not ones still in the kitchen.
	{/snippet}
</ChartPanel>

<style>
	.pad {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 0.5rem 1.25rem 1.25rem;
	}

	.ring-row {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 1.25rem;
	}

	.ring {
		position: relative;
		flex: none;
		width: 132px;
		height: 132px;
	}

	.ring svg {
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}

	.ring circle {
		fill: none;
		stroke-width: 12;
	}

	.ring-track {
		stroke: var(--surface-2);
	}

	.ring-bad {
		stroke: color-mix(in srgb, var(--danger) 70%, transparent);
	}

	.ring-good {
		stroke: color-mix(in srgb, var(--accent) 86%, #000);
		stroke-linecap: butt;
		transition: stroke-dasharray 0.6s ease;
	}

	.ring-centre {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.1rem;
	}

	.ring-centre strong {
		font-family: var(--font-display);
		font-size: var(--fs-stat);
		font-weight: 650;
		letter-spacing: -0.02em;
		color: var(--text);
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}

	.ring-centre span {
		font-size: var(--fs-label);
		color: var(--text-3);
	}

	.legend {
		list-style: none;
		margin: 0;
		padding: 0;
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.legend li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: var(--fs-code);
		color: var(--text-2);
	}

	.legend-label {
		flex: 1;
		min-width: 0;
	}

	.legend strong {
		font-weight: 650;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}

	.key {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: 2px;
	}

	.key.good {
		background: color-mix(in srgb, var(--accent) 86%, #000);
	}

	.key.bad {
		background: color-mix(in srgb, var(--danger) 70%, transparent);
	}

	.legend .rate {
		padding-top: 0.6rem;
		border-top: 1px solid var(--border-subtle);
		font-size: var(--fs-label);
		color: var(--text-3);
	}

	.legend .rate.warn {
		color: var(--danger);
		font-weight: 600;
	}

	.timings {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.timings div {
		min-width: 0;
		padding: 0.75rem 0.9rem;
		border-radius: var(--radius);
		background: var(--surface-2);
	}

	dt {
		font-size: var(--fs-label);
		font-weight: 550;
		color: var(--text-3);
	}

	dd {
		margin: 0.2rem 0 0.1rem;
		font-family: var(--font-display);
		font-size: var(--fs-title);
		font-weight: 650;
		letter-spacing: -0.015em;
		color: var(--text);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.timings p {
		margin: 0;
		font-size: var(--fs-label);
		color: var(--text-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
