<script lang="ts">
	import { onMount } from 'svelte';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import { orderBoard, STAGES } from '$lib/tenant/orders.svelte';
	import StoreOrderCard from '$lib/components/shop/StoreOrderCard.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import { isOnline } from '$lib/pwa.svelte';

	/** Which stage the phone tabs are showing. */
	let active = $state(STAGES[0].key);

	// A brand new order should be visible without hunting for it.
	let lastNewCount = 0;

	onMount(() => {
		orderBoard.acquire();
		return () => orderBoard.release();
	});

	$effect(() => {
		const n = orderBoard.newCount;
		// Only jump when something actually arrived, not on every poll.
		if (n > lastNewCount) active = 'PENDING';
		lastNewCount = n;
	});

	const activeStage = $derived(STAGES.find((s) => s.key === active) ?? STAGES[0]);
	const visible = $derived(orderBoard.forStage(active));
	const totalLive = $derived(orderBoard.activeCount);
</script>

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
	<div class="panel" style="text-align:center;padding:2rem 1.25rem;">
		<span
			class="osh-empty-icon"
			style="width:3rem;height:3rem;margin:0 auto 0.8rem;background:var(--accent-soft);color:var(--accent-dark);display:grid;place-items:center;border-radius:999px;"
		>
			<CircleCheck size={22} strokeWidth={1.7} />
		</span>
		<h2 style="font-family:var(--font-display);font-size:1.05rem;font-weight:650;margin:0 0 0.3rem;">
			No open orders
		</h2>
		<p class="muted" style="margin:0;font-size:0.85rem;">
			New orders appear here the moment a customer checks out.
		</p>
	</div>
{:else if orderBoard.loading}
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
					{#each cards as order (order.id)}
						<StoreOrderCard {order} stage={stage} />
					{/each}
				{/if}
			</section>
		{/each}
	</div>
{/if}

<style>
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
		font-size: 0.95rem;
		font-weight: 650;
		letter-spacing: -0.01em;
	}

	.osh-col-empty {
		margin: 0;
		padding: 1.25rem 0.85rem;
		text-align: center;
		font-size: 0.82rem;
		color: var(--text-3);
		background: var(--surface);
		border: 1px dashed var(--border);
		border-radius: var(--radius);
	}

	.osh-empty-icon {
		display: grid;
		place-items: center;
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

	@media (min-width: 1280px) {
		.osh-orders {
			gap: 1rem;
		}
	}
</style>
