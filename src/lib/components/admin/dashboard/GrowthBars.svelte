<script lang="ts">
	import Skeleton from '../Skeleton.svelte';

	let {
		weeks = [] as { week_start?: string; tenant_count?: number }[],
		loading = false
	}: { weeks?: { week_start?: string; tenant_count?: number }[]; loading?: boolean } = $props();

	const values = $derived(weeks.map((w) => Number(w.tenant_count ?? 0)));
	const max = $derived(Math.max(...values, 1));
	const recent = $derived(values.slice(-4).reduce((a, b) => a + b, 0));
	const label = (iso?: string) =>
		iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
	let hover = $state<number | null>(null);
</script>

<section class="panel box">
	<header class="ph">
		<h3>New businesses</h3>
		<span class="meta">{loading ? '' : `+${recent} in 4 weeks`}</span>
	</header>
	{#if loading}
		<Skeleton height="6.5rem" />
	{:else if values.every((v) => v === 0)}
		<p class="empty">No new businesses in the last 12 weeks.</p>
	{:else}
		<div class="bars" role="img" aria-label="New businesses per week">
			{#each values as v, i (i)}
				<div class="col" onpointerenter={() => (hover = i)} onpointerleave={() => (hover = null)} role="presentation">
					<span class="val" class:show={hover === i}>{v}</span>
					<span class="bar" class:on={hover === i} style={`height:${Math.max((v / max) * 100, v ? 6 : 2)}%`}></span>
				</div>
			{/each}
		</div>
		<div class="axis">
			<span>{label(weeks[0]?.week_start)}</span>
			<span>{label(weeks[weeks.length - 1]?.week_start)}</span>
		</div>
	{/if}
</section>

<style>
	.box {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.ph {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: var(--sp-6);
	}

	h3 {
		margin: 0;
		font-size: var(--fs-body);
		font-weight: 600;
		color: var(--text);
	}

	.meta {
		font-size: var(--fs-meta);
		color: var(--text-3);
	}

	.bars {
		display: flex;
		flex: 1;
		align-items: flex-end;
		gap: var(--sp-2);
		min-height: 6.5rem;
	}

	.col {
		position: relative;
		display: flex;
		flex: 1;
		align-items: flex-end;
		height: 100%;
	}

	.bar {
		width: 100%;
		border-radius: 2px;
		background: color-mix(in srgb, var(--accent) 38%, transparent);
		transition: background 0.1s;
	}

	.bar.on {
		background: var(--accent);
	}

	.val {
		position: absolute;
		left: 50%;
		top: 0;
		transform: translateX(-50%);
		font-size: var(--fs-meta);
		font-weight: 600;
		color: var(--text);
		opacity: 0;
	}

	.val.show {
		opacity: 1;
	}

	.axis {
		display: flex;
		justify-content: space-between;
		margin-top: var(--sp-3);
		font-size: var(--fs-micro);
		color: var(--text-3);
	}

	.empty {
		margin: 0;
		padding: var(--sp-10) 0;
		text-align: center;
		font-size: var(--fs-meta);
		color: var(--text-3);
	}
</style>
