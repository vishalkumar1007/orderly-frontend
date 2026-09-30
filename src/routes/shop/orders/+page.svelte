<script lang="ts">
	import { onMount } from 'svelte';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Plus from '@lucide/svelte/icons/plus';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import StoreOrderCard from '$lib/components/shop/StoreOrderCard.svelte';
	import SellingOrderDetail from '$lib/components/shop/SellingOrderDetail.svelte';
	import SellingCounterDrawer from '$lib/components/shop/SellingCounterDrawer.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import { isOnline } from '$lib/pwa.svelte';
	import { orderBoard, STAGES, type Order, type OrderStage } from '$lib/tenant/orders.svelte';

	/** Which stage the phone tabs are showing. */
	let active = $state(STAGES[0].key);
	let detailOpen = $state(false);
	let detailOrder = $state<Order | null>(null);
	let detailStage = $state<OrderStage | null>(null);
	let counterOpen = $state(false);

	// A brand new order should be visible without hunting for it.
	let lastNewCount = 0;

	onMount(() => {
		orderBoard.acquire('ops');
		return () => orderBoard.release('ops');
	});

	$effect(() => {
		const n = orderBoard.newCount;
		// Only jump when something actually arrived, not on every poll.
		if (n > lastNewCount) active = 'PENDING';
		lastNewCount = n;
	});

	const totalLive = $derived(orderBoard.activeCount);

	const lastSyncLabel = $derived.by(() => {
		if (!orderBoard.lastSync) return '';
		const secs = Math.max(0, Math.round((Date.now() - orderBoard.lastSync) / 1000));
		if (secs < 5) return 'Just updated';
		if (secs < 60) return `Updated ${secs}s ago`;
		return `Updated ${Math.round(secs / 60)}m ago`;
	});

	function openDetail(order: Order, stage: OrderStage) {
		detailOrder = order;
		detailStage = stage;
		detailOpen = true;
	}

	function onCounterPlaced() {
		active = 'PENDING';
	}
</script>

<div class="selling">
	<header class="selling-head">
		<div>
			<p class="selling-lead muted">
				Accept orders, take counter sales, and move tickets through the pipeline.
			</p>
			<div class="selling-stats">
				{#each STAGES as stage (stage.key)}
					<span class="selling-stat">
						<strong>{orderBoard.countFor(stage.key)}</strong>
						{stage.short}
					</span>
				{/each}
				{#if lastSyncLabel}
					<span class="selling-stat muted">{lastSyncLabel}</span>
				{/if}
			</div>
		</div>
		<div class="selling-actions">
			<button
				class="btn btn-ghost btn-sm"
				type="button"
				onclick={() => void orderBoard.refresh()}
				disabled={orderBoard.loading}
			>
				<RefreshCw size={14} strokeWidth={2} />
				Refresh
			</button>
			<button class="btn btn-primary btn-sm" type="button" onclick={() => (counterOpen = true)}>
				<Plus size={14} strokeWidth={2.25} />
				New counter order
			</button>
		</div>
	</header>

	{#if orderBoard.error}
		<div class="osh-banner offline">
			<span>{orderBoard.error}</span>
			<span class="osh-banner-spacer"></span>
			<button class="btn btn-quiet btn-sm" onclick={() => void orderBoard.refresh()}>Retry</button>
		</div>
	{/if}

	{#if !isOnline()}
		<div class="osh-banner offline">You're offline — showing the last orders we received.</div>
	{/if}

	<!-- Status tabs. On a phone these replace the four-column board. -->
	<div class="os-tabs" role="tablist" aria-label="Order status">
		{#each STAGES as stage (stage.key)}
			{@const count = orderBoard.countFor(stage.key)}
			<button
				class={['os-tab', active === stage.key ? 'active' : ''].join(' ')}
				role="tab"
				aria-selected={active === stage.key}
				onclick={() => (active = stage.key)}
			>
				{stage.short}
				<span class="os-tab-count">{count}</span>
			</button>
		{/each}
	</div>

	{#if totalLive === 0 && !orderBoard.loading}
		<div class="panel selling-empty">
			<span class="selling-empty-icon">
				<CircleCheck size={22} strokeWidth={1.7} />
			</span>
			<h2>No open orders</h2>
			<p class="muted">
				New online orders appear here the moment a customer checks out. You can also place a
				walk-in sale at the counter.
			</p>
			<button class="btn btn-primary" type="button" onclick={() => (counterOpen = true)}>
				<Plus size={15} strokeWidth={2.25} />
				New counter order
			</button>
		</div>
	{:else if orderBoard.loading && totalLive === 0}
		<div class="osh-orders">
			{#each [1, 2, 3] as _, i (i)}
				<div class="osorder"><Skeleton height="4.5rem" /></div>
			{/each}
		</div>
	{:else}
		<!-- Phone: the selected stage only. Desktop: the whole board (see CSS). -->
		<div class="osh-orders">
			{#each STAGES as stage (stage.key)}
				{@const cards = orderBoard.forStage(stage.key)}
				<section class="osh-col" class:osh-col-active={active === stage.key} aria-label={stage.label}>
					<header class="osh-col-head">
						<h2>{stage.label}</h2>
						<span class="os-tab-count">{cards.length}</span>
					</header>
					{#if cards.length === 0}
						<p class="osh-col-empty">Nothing here</p>
					{:else}
						{#each cards as order (order.id || order.order_number)}
							<StoreOrderCard
								{order}
								{stage}
								onclick={() => openDetail(order, stage)}
							/>
						{/each}
					{/if}
				</section>
			{/each}
		</div>
	{/if}
</div>

<SellingOrderDetail bind:open={detailOpen} order={detailOrder} stage={detailStage} />
<SellingCounterDrawer bind:open={counterOpen} onPlaced={onCounterPlaced} />

<style>
	.selling {
		display: grid;
		gap: 0.85rem;
	}

	.selling-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.selling-lead {
		margin: 0 0 0.55rem;
		font-size: var(--fs-body);
		line-height: 1.45;
	}

	.selling-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem 0.75rem;
		font-size: var(--fs-tab);
	}

	.selling-stat strong {
		font-weight: 750;
		margin-right: 0.2rem;
	}

	.selling-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.selling-empty {
		text-align: center;
		padding: 2rem 1.25rem;
		display: grid;
		gap: 0.55rem;
		justify-items: center;
	}

	.selling-empty h2 {
		font-family: var(--font-display);
		font-size: var(--fs-title);
		font-weight: 650;
		margin: 0;
	}

	.selling-empty p {
		margin: 0;
		font-size: var(--fs-body);
		max-width: 28rem;
	}

	.selling-empty-icon {
		width: 3rem;
		height: 3rem;
		margin: 0 auto 0.25rem;
		background: var(--icon-bg);
		color: var(--icon-fg);
		display: grid;
		place-items: center;
		border-radius: 999px;
	}

	.osh-orders {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	/* On a phone only the selected stage is shown. */
	.osh-col {
		display: none;
		flex-direction: column;
		gap: 0.6rem;
	}

	.osh-col-active {
		display: flex;
	}

	.osh-col-head {
		display: none;
		align-items: center;
		gap: 0.5rem;
	}

	.osh-col-head h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-title);
		font-weight: 650;
		letter-spacing: -0.01em;
	}

	.osh-col-empty {
		margin: 0;
		padding: 1.25rem 0.85rem;
		text-align: center;
		font-size: var(--fs-body);
		color: var(--text-3);
		background: var(--surface);
		border: 1px dashed var(--border);
		border-radius: var(--radius);
	}

	/* Desktop: restore the four-column board. */
	@media (min-width: 900px) {
		.os-tabs {
			display: none;
		}

		.osh-orders {
			display: grid;
			gap: 0.75rem;
			grid-template-columns: repeat(4, minmax(0, 1fr));
			align-items: start;
		}

		.osh-col {
			display: flex;
		}

		.osh-col-head {
			display: flex;
		}
	}
</style>
