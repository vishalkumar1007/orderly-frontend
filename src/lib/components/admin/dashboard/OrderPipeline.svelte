<script lang="ts">
	import IconArrowUpRight from '@tabler/icons-svelte/icons/arrow-up-right';
	import type { StatusPoint } from '$lib/tenant/analytics';
	import Skeleton from '../Skeleton.svelte';
	import ChartPanel from './ChartPanel.svelte';

	/**
	 * Where the orders are right now, as a pipeline rather than a pie: each
	 * stage is a step towards being served, and a stage that grows is a queue.
	 * The watch list under it names the three things an owner can act on.
	 */
	let {
		statuses = [] as StatusPoint[],
		pending = 0,
		preparing = 0,
		ready = 0,
		unavailable = 0,
		cancelledToday = 0,
		loading = false
	}: {
		statuses?: StatusPoint[];
		pending?: number;
		preparing?: number;
		ready?: number;
		unavailable?: number;
		cancelledToday?: number;
		loading?: boolean;
	} = $props();

	const ORDER = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];
	const LABEL: Record<string, string> = {
		PENDING: 'Pending',
		ACCEPTED: 'Accepted',
		PREPARING: 'Preparing',
		READY: 'Ready',
		COMPLETED: 'Completed',
		CANCELLED: 'Cancelled'
	};
	const TINT: Record<string, string> = {
		PENDING: 'var(--warn)',
		ACCEPTED: 'var(--text-3)',
		PREPARING: 'var(--accent-2)',
		READY: 'var(--accent)',
		COMPLETED: 'var(--success)',
		CANCELLED: 'var(--danger)'
	};

	const stages = $derived(
		[...statuses]
			.filter((s) => s.count > 0)
			.sort((a, b) => {
				const ai = ORDER.indexOf(a.status);
				const bi = ORDER.indexOf(b.status);
				return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
			})
			.map((s) => ({
				status: s.status,
				label: LABEL[s.status] ?? s.status,
				value: Number(s.count),
				color: TINT[s.status] ?? 'var(--text-3)'
			}))
	);

	const total = $derived(stages.reduce((sum, s) => sum + s.value, 0));
	const liveTotal = $derived(pending + preparing + ready);
	const share = (value: number) => (total ? Math.max(Math.round((value / total) * 100), 2) : 0);

	const watch = $derived(
		[
			{
				count: pending,
				label: `${pending} waiting`,
				detail: pending === 1 ? 'order needs accepting' : 'orders need accepting',
				href: '/shop/orders',
				tone: 'warn'
			},
			{
				count: unavailable,
				label: `${unavailable} unavailable`,
				detail: unavailable === 1 ? 'item is hidden' : 'items are hidden',
				href: '/shop/menu',
				tone: 'warn'
			},
			{
				count: cancelledToday,
				label: `${cancelledToday} cancelled`,
				detail: cancelledToday === 1 ? 'order today' : 'orders today',
				href: '/shop/order-history',
				tone: 'bad'
			}
		].filter((w) => w.count > 0)
	);
</script>

<ChartPanel title="Order pipeline" subtitle={total > 0 ? `${total} orders all time · ${liveTotal} in progress` : ''} extra="pipeline-panel">
	{#snippet actions()}
		<a class="link" href="/shop/orders">Open board <IconArrowUpRight size={13} stroke={1.7} /></a>
	{/snippet}

	{#if loading}
		<div class="pad"><Skeleton height="260px" /></div>
	{:else if total === 0}
		<div class="empty">No orders yet. The pipeline fills in with the first one.</div>
	{:else}
		<div class="pad">
			<div class="live" role="group" aria-label="Orders in progress">
				<a class="live-cell" href="/shop/orders">
					<span class="live-value">{pending}</span>
					<span class="live-label">Pending</span>
				</a>
				<a class="live-cell" href="/shop/kitchen">
					<span class="live-value">{preparing}</span>
					<span class="live-label">Preparing</span>
				</a>
				<a class="live-cell" href="/shop/kitchen">
					<span class="live-value">{ready}</span>
					<span class="live-label">Ready</span>
				</a>
			</div>

			<ul class="stages">
				{#each stages as s (s.status)}
					<li>
						<div class="stage-top">
							<span class="dot" style={`background:${s.color}`}></span>
							<span class="stage-label">{s.label}</span>
							<span class="stage-share">{Math.round((s.value / total) * 100)}%</span>
							<span class="stage-value">{s.value}</span>
						</div>
						<span class="track">
							<span class="fill" style={`width:${share(s.value)}%;background:${s.color}`}></span>
						</span>
					</li>
				{/each}
			</ul>

			<div class="watch">
				<span class="watch-title">Watch list</span>
				{#if pending === 0 && unavailable === 0 && cancelledToday === 0}
					<p class="clear">Nothing needs attention right now.</p>
				{:else}
					<ul>
						{#each watch as w (w.label)}
							<li>
								<a href={w.href} class={w.tone}>
									<span>{w.label}</span>
									<span class="watch-detail">{w.detail}</span>
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	{/if}
</ChartPanel>

<style>
	.pad {
		padding: 0.35rem 1rem 1rem;
	}

	.link {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		font-size: var(--fs-code);
		font-weight: 550;
		color: var(--accent-dark);
		text-decoration: none;
	}

	.link:hover {
		text-decoration: underline;
	}

	.live {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		overflow: hidden;
		margin-bottom: 0.9rem;
	}

	.live-cell {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		padding: 0.55rem 0.6rem;
		color: inherit;
		text-decoration: none;
		transition: background var(--tr);
	}

	.live-cell + .live-cell {
		border-left: 1px solid var(--border-subtle);
	}

	.live-cell:hover {
		background: var(--surface-hover);
	}

	.live-value {
		font-family: var(--font-display);
		font-size: var(--fs-title);
		font-weight: 650;
		line-height: 1.1;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}

	.live-label {
		font-size: var(--fs-label);
		color: var(--text-3);
	}

	.stages {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.62rem;
	}

	.stage-top {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		margin-bottom: 0.28rem;
	}

	.dot {
		width: 7px;
		height: 7px;
		border-radius: 2px;
		flex: none;
		align-self: center;
	}

	.stage-label {
		font-size: var(--fs-body);
		color: var(--text-2);
	}

	.stage-share {
		margin-left: auto;
		font-size: var(--fs-meta);
		color: var(--text-3);
		font-variant-numeric: tabular-nums;
	}

	.stage-value {
		min-width: 2rem;
		text-align: right;
		font-size: var(--fs-body);
		font-weight: 650;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}

	.track {
		display: block;
		height: 5px;
		border-radius: 3px;
		background: var(--surface-3, var(--surface-2));
		overflow: hidden;
	}

	.fill {
		display: block;
		height: 100%;
		border-radius: 3px;
		opacity: 0.85;
	}

	.watch {
		margin-top: 1rem;
		padding-top: 0.8rem;
		border-top: 1px solid var(--border-subtle);
	}

	.watch-title {
		display: block;
		margin-bottom: 0.45rem;
		font-size: var(--fs-label);
		font-weight: 650;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-3);
	}

	.watch ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.watch a {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		padding: 0.28rem 0.4rem;
		margin: 0 -0.4rem;
		border-radius: var(--radius-sm);
		text-decoration: none;
		font-size: var(--fs-code);
		font-weight: 600;
		transition: background var(--tr);
	}

	.watch a:hover {
		background: var(--surface-2);
	}

	.watch a.warn {
		color: var(--warn);
	}

	.watch a.bad {
		color: var(--danger);
	}

	.watch-detail {
		font-weight: 500;
		color: var(--text-3);
	}

	.clear {
		margin: 0;
		font-size: var(--fs-code);
		color: var(--text-3);
	}

	.empty {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 260px;
		padding: 0 1.5rem;
		text-align: center;
		font-size: var(--fs-body);
		color: var(--text-3);
	}
</style>
