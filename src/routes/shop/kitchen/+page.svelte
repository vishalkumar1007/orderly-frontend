<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import ChefHat from '@lucide/svelte/icons/chef-hat';
	import { orderBoard, STAGES } from '$lib/tenant/orders.svelte';
	import { toast } from '$lib/components/admin/toast';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import OpsFullscreenToggle from '$lib/components/admin/OpsFullscreenToggle.svelte';
	import { isOnline } from '$lib/pwa.svelte';
	import { terms } from '$lib/tenant/businessType.svelte';

	/**
	 * Prep board — same live data as /shop/orders, tuned for the counter:
	 * no money, no customer names up front, and one big tap target per ticket.
	 *
	 * The stage names come from the business type. The workflow underneath is
	 * identical for everyone, but the words are not: a grocer's third column is
	 * packing, not cooking, and a hotel delivers rather than hands over.
	 */
	const t = $derived(terms());
	const KITCHEN_STAGES = $derived(
		STAGES.map((s, i) => ({
			...s,
			label:
				[
					`New ${t.ticket.toLowerCase()}s`,
					'Queued',
					t.prep,
					`Ready to be ${t.handover}`
				][i] ?? s.label
		}))
	);

	let active = $state('PREPARING');

	const fullscreen = $derived($page.url.searchParams.get('fullscreen') === '1');

	onMount(() => {
		orderBoard.acquire('ops');
		return () => orderBoard.release('ops');
	});

	// Only jump when a stage newly gets work (0→N), not on every poll.
	let lastStageCounts: Record<string, number> = {};
	let stageCountsSeeded = false;

	$effect(() => {
		let jumpTo: string | null = null;
		for (const s of KITCHEN_STAGES) {
			const n = orderBoard.countFor(s.key);
			const prev = lastStageCounts[s.key] ?? 0;
			lastStageCounts[s.key] = n;
			if (stageCountsSeeded && prev === 0 && n > 0 && !jumpTo) jumpTo = s.key;
		}
		stageCountsSeeded = true;
		if (jumpTo) active = jumpTo;
	});

	const stage = $derived(KITCHEN_STAGES.find((s) => s.key === active) ?? KITCHEN_STAGES[0]);
	const tickets = $derived(orderBoard.forStage(active));
	const totalLive = $derived(orderBoard.activeCount);

	async function advance(order: { id: string; order_number: number }, action: string, label: string) {
		try {
			await orderBoard.transition(order as never, action);
			toast.success(`#${order.order_number} → ${label}`);
		} catch {
			toast.error(`Could not update that ${t.ticket.toLowerCase()}`);
		}
	}
</script>

<div class={['osh-kitchen', fullscreen ? 'osh-kitchen-fs' : ''].join(' ')}>
	{#if fullscreen}
		<div class="osh-kitchen-fs-bar">
			<span class="osh-kitchen-count">
				<ChefHat size={14} strokeWidth={2} />
				{totalLive} {totalLive === 1 ? t.order.toLowerCase() : t.orders.toLowerCase()} live
			</span>
			<OpsFullscreenToggle label="Fullscreen" />
		</div>
	{:else}
		<div class="osh-kitchen-toolbar">
			<p class="osh-kitchen-lead">
				{t.ticket} board for the {t.station.toLowerCase()} — the same {t.orders.toLowerCase()} as
				<a href="/shop/orders">Selling</a>, without money or customer details up front.
			</p>
			<OpsFullscreenToggle label="Fullscreen" />
		</div>
	{/if}

	{#if !isOnline()}
		<div class="osh-banner offline">You're offline — the board may be out of date.</div>
	{/if}

	{#if orderBoard.error}
		<div class="osh-banner offline">
			<span>{orderBoard.error}</span>
			<span class="osh-banner-spacer"></span>
			<button class="btn btn-quiet btn-sm" onclick={() => void orderBoard.refresh()}>Retry</button>
		</div>
	{/if}

	{#if !fullscreen}
		<div class="osh-kitchen-top">
			<span class="osh-kitchen-count">
				<ChefHat size={13} strokeWidth={2} />
				{totalLive} {totalLive === 1 ? t.order.toLowerCase() : t.orders.toLowerCase()} live
			</span>
		</div>
	{/if}

	<div class="os-tabs" role="tablist" aria-label="{t.station} stage">
		{#each KITCHEN_STAGES as s (s.key)}
			{@const count = orderBoard.countFor(s.key)}
			<button
				class={['os-tab', active === s.key ? 'active' : ''].join(' ')}
				role="tab"
				aria-selected={active === s.key}
				onclick={() => (active = s.key)}
			>
			{s.short}
			<span class="os-tab-count">{count}</span>
		</button>
	{/each}
</div>

{#if orderBoard.loading}
	<div class="osh-tickets">
		{#each [1, 2] as _, i (i)}
			<div class="os-ticket"><Skeleton height="6rem" /></div>
		{/each}
	</div>
{:else if tickets.length === 0}
	<div class="osh-ticket-empty">
		<span class="osh-ticket-empty-icon">
			<ChefHat size={26} strokeWidth={1.5} />
		</span>
		<h2>Nothing in {stage.label.toLowerCase()}</h2>
		<p>
			{#if totalLive === 0}
				New {t.ticket.toLowerCase()}s will show up here the moment they come in.
			{:else}
				Pick another stage above, or enjoy the quiet.
			{/if}
		</p>
	</div>
{:else}
	<div class="osh-tickets">
		{#each tickets as order (order.id)}
			<article class="os-ticket">
				<div class="os-ticket-head">
					<span class="os-ticket-num">#{order.order_number}</span>
					<span class="os-ticket-stage">{stage.label}</span>
				</div>
				<ul class="os-ticket-items">
					{#each order.items as item (item.product_name)}
						<li><b>{item.quantity}</b><span>{item.product_name}</span></li>
					{/each}
				</ul>
				{#if order.customer_name}
					<div class="os-ticket-cust">{order.customer_name}</div>
				{/if}
				<button
					class="btn btn-primary os-ticket-go"
					type="button"
					disabled={orderBoard.isBusy(order.id)}
					onclick={() => advance(order, stage.action, stage.short.toLowerCase())}
				>
					{orderBoard.isBusy(order.id) ? 'Saving…' : stage.actionLabel}
				</button>
			</article>
		{/each}
	</div>
{/if}
</div>

<style>
	.osh-kitchen-toolbar {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.85rem;
	}

	.osh-kitchen-lead {
		margin: 0;
		font-size: 0.85rem;
		color: var(--text-3);
		line-height: 1.45;
		flex: 1;
	}

	.osh-kitchen-lead a {
		color: var(--accent-dark);
		font-weight: 600;
	}

	.osh-kitchen-fs {
		min-height: 100dvh;
		padding: 1rem 1.25rem 2rem;
		background: var(--bg);
	}

	.osh-kitchen-fs-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.85rem;
	}

	.osh-kitchen-top {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 0.45rem;
	}

	.osh-kitchen-count {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.25rem 0.55rem;
		border-radius: 999px;
		background: var(--icon-bg);
		color: var(--icon-fg);
		font-size: 0.72rem;
		font-weight: 700;
		white-space: nowrap;
	}

	.osh-tickets {
		display: grid;
		gap: 0.7rem;
		grid-template-columns: 1fr;
	}

	.os-ticket {
		background: var(--surface);
		border: 1px solid var(--border);
		border-left: 4px solid var(--accent);
		border-radius: var(--radius);
		padding: 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.os-ticket-head {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}

	.os-ticket-num {
		font-family: var(--font-display);
		font-size: 1.6rem;
		font-weight: 800;
		letter-spacing: -0.03em;
		line-height: 1;
	}

	.os-ticket-stage {
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-3);
	}

	.os-ticket-items {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.os-ticket-items li {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		font-size: 1rem;
		line-height: 1.35;
	}

	.os-ticket-items b {
		flex: none;
		min-width: 1.75rem;
		font-size: 1.05rem;
		font-weight: 800;
		color: var(--icon-fg);
		font-variant-numeric: tabular-nums;
	}

	.os-ticket-cust {
		font-size: 0.78rem;
		color: var(--text-3);
	}

	.os-ticket-go {
		width: 100%;
		min-height: 3.25rem;
		font-size: 1rem;
		font-weight: 700;
	}

	.osh-ticket-empty {
		text-align: center;
		padding: 2.5rem 1.25rem;
		border: 1px dashed var(--border);
		border-radius: var(--radius);
		background: var(--surface);
	}

	.osh-ticket-empty-icon {
		width: 3.25rem;
		height: 3.25rem;
		margin: 0 auto 0.85rem;
		border-radius: 999px;
		background: var(--icon-bg);
		color: var(--icon-fg);
		display: grid;
		place-items: center;
	}

	.osh-ticket-empty h2 {
		margin: 0 0 0.3rem;
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 650;
		letter-spacing: -0.01em;
	}

	.osh-ticket-empty p {
		margin: 0;
		font-size: 0.85rem;
		color: var(--text-3);
		line-height: 1.5;
	}

	@media (min-width: 700px) {
		.osh-tickets {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (min-width: 1100px) {
		.osh-tickets {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
