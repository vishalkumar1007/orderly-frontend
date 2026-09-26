<script lang="ts">
	import type { Snippet } from 'svelte';
	import Skeleton from './Skeleton.svelte';

	let {
		label,
		value,
		hint = '',
		loading = false,
		icon,
		/** Percentage change plus direction, when a prior period is available. */
		trend = null as { pct: number; dir: 'up' | 'down' | 'flat' } | null,
		/** Bar series drawn as a sparkline behind the value. */
		series = [] as number[],
		tone = ''
	}: {
		label: string;
		value: string | number;
		hint?: string;
		loading?: boolean;
		icon?: Snippet;
		trend?: { pct: number; dir: 'up' | 'down' | 'flat' } | null;
		series?: number[];
		/** Extra class for the value, e.g. to colour a status count. */
		tone?: string;
	} = $props();

	/**
	 * The sparkline scales against its own peak, and every bar keeps a floor
	 * height so a flat series still reads as a series rather than an empty box.
	 */
	const peak = $derived(Math.max(...series, 1));
</script>

<div class="metric">
	<div class="metric-top">
		<span class="metric-label">{label}</span>
		{#if trend}
			<span class={['metric-trend', trend.dir].join(' ')}>
				{trend.dir === 'up' ? '↗' : trend.dir === 'down' ? '↘' : '→'}
				{trend.pct}%
			</span>
		{/if}
	</div>

	{#if loading}
		<Skeleton height="1.5rem" width="60%" />
	{:else}
		<div class="metric-main">
			<span class={['metric-value', tone].join(' ')}>{value}</span>
			{#if series.length > 1}
				<div class="spark" aria-hidden="true">
					{#each series as v, i (i)}
						<span
							style={`height:${Math.max((v / peak) * 100, 6)}%;opacity:${0.3 + (v / peak) * 0.7};`}
						></span>
					{/each}
				</div>
			{/if}
		</div>
		{#if hint}
			<p class="metric-hint">{hint}</p>
		{/if}
	{/if}

	{#if icon}
		<span class="metric-icon">{@render icon()}</span>
	{/if}
</div>

<style>
	.metric {
		position: relative;
		padding: 0.9rem 1rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-1);
		min-width: 0;
	}

	.metric-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.metric-label {
		font-size: 0.74rem;
		font-weight: 500;
		color: var(--text-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.metric-trend {
		font-size: 0.72rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.metric-trend.up {
		color: var(--ok, #059669);
	}

	.metric-trend.down {
		color: var(--danger, #dc2626);
	}

	.metric-trend.flat {
		color: var(--text-3);
	}

	.metric-main {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.6rem;
		margin-top: 0.35rem;
	}

	.metric-value {
		font-size: 1.5rem;
		font-weight: 600;
		line-height: 1.1;
		color: var(--text-1);
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}

	.metric-hint {
		margin: 0.3rem 0 0;
		font-size: 0.74rem;
		color: var(--text-3);
	}

	.metric-icon {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		display: inline-flex;
		color: var(--text-3);
		opacity: 0.5;
	}

	.spark {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 26px;
		min-width: 0;
		flex-shrink: 1;
	}

	.spark span {
		flex: 1 1 auto;
		min-width: 2px;
		max-width: 5px;
		border-radius: 1px;
		background: var(--accent);
	}
</style>
