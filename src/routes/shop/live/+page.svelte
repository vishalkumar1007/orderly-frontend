<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import MonitorPlay from '@lucide/svelte/icons/monitor-play';
	import OpsFullscreenToggle from '$lib/components/admin/OpsFullscreenToggle.svelte';
	import { orderBoard } from '$lib/tenant/orders.svelte';

	const fullscreen = $derived($page.url.searchParams.get('fullscreen') === '1');

	onMount(() => {
		orderBoard.acquire('ops');
		return () => orderBoard.release('ops');
	});

	const preparing = $derived(orderBoard.forStage('PREPARING'));
	const ready = $derived(orderBoard.forStage('READY'));
</script>

<div class={['live-activity', fullscreen ? 'live-activity-fs' : ''].join(' ')}>
	<header class="live-activity-head">
		<div class="live-activity-brand">
			<MonitorPlay size={fullscreen ? 28 : 18} strokeWidth={1.75} />
			<div>
				<strong>Live Activity</strong>
				{#if !fullscreen}
					<p class="muted">Customer-facing order status — open fullscreen on a TV or display.</p>
				{/if}
			</div>
		</div>
		<OpsFullscreenToggle label="Fullscreen" />
	</header>

	{#if orderBoard.error}
		<div class="osh-banner offline">
			<span>{orderBoard.error}</span>
			<span class="osh-banner-spacer"></span>
			<button class="btn btn-quiet btn-sm" onclick={() => void orderBoard.refresh()}>Retry</button>
		</div>
	{/if}

	<div class="live-activity-board" aria-live="polite">
		<section class="live-col">
			<h2>Preparing</h2>
			{#if preparing.length === 0}
				<p class="live-empty">No orders preparing</p>
			{:else}
				<ul>
					{#each preparing as order (order.id)}
						<li class="live-ticket">#{order.order_number}</li>
					{/each}
				</ul>
			{/if}
		</section>
		<section class="live-col live-col-ready">
			<h2>Ready</h2>
			{#if ready.length === 0}
				<p class="live-empty">Waiting for ready orders</p>
			{:else}
				<ul>
					{#each ready as order (order.id)}
						<li class="live-ticket live-ticket-ready">#{order.order_number}</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>

	{#if !fullscreen && preparing.length === 0 && ready.length === 0 && !orderBoard.error}
		<p class="muted live-hint">
			When orders are in kitchen stages, ticket numbers appear here for customers to watch.
			Use Fullscreen for a dedicated display.
		</p>
	{/if}
</div>

<style>
	.live-activity {
		display: grid;
		gap: 1.25rem;
	}

	.live-activity-fs {
		min-height: 100dvh;
		padding: 1.5rem 2rem 2rem;
		background: #0b0d12;
		color: #f4f6fb;
		gap: 2rem;
	}

	.live-activity-fs .muted {
		color: color-mix(in srgb, #f4f6fb 55%, transparent);
	}

	.live-activity-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.live-activity-brand {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.live-activity-brand strong {
		display: block;
		font-size: 1.05rem;
		font-weight: 700;
	}

	.live-activity-fs .live-activity-brand strong {
		font-size: 1.5rem;
		letter-spacing: 0.02em;
	}

	.live-activity-brand p {
		margin: 0.2rem 0 0;
		font-size: 0.85rem;
	}

	.live-activity-board {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		min-height: 16rem;
	}

	.live-activity-fs .live-activity-board {
		gap: 1.5rem;
		min-height: calc(100dvh - 8rem);
	}

	.live-col {
		border: 1px solid var(--border);
		border-radius: var(--radius-lg, 14px);
		padding: 1rem 1.1rem;
		background: var(--surface);
	}

	.live-activity-fs .live-col {
		background: #141821;
		border-color: rgba(255, 255, 255, 0.08);
	}

	.live-col h2 {
		margin: 0 0 0.85rem;
		font-size: 0.75rem;
		font-weight: 750;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted, var(--text-2));
	}

	.live-activity-fs .live-col h2 {
		font-size: 1rem;
		color: color-mix(in srgb, #f4f6fb 60%, transparent);
	}

	.live-col ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.55rem;
	}

	.live-ticket {
		font-size: 1.35rem;
		font-weight: 750;
		padding: 0.65rem 0.85rem;
		border-radius: 10px;
		background: color-mix(in srgb, var(--bg) 80%, var(--border));
	}

	.live-activity-fs .live-ticket {
		font-size: clamp(1.75rem, 4vw, 3rem);
		padding: 1rem 1.25rem;
		background: rgba(255, 255, 255, 0.05);
	}

	.live-ticket-ready {
		background: color-mix(in srgb, #16a34a 18%, var(--surface));
	}

	.live-activity-fs .live-ticket-ready {
		background: rgba(34, 197, 94, 0.18);
		color: #bbf7d0;
	}

	.live-empty {
		margin: 0;
		font-size: 0.9rem;
		color: var(--muted, var(--text-2));
	}

	.live-activity-fs .live-empty {
		font-size: 1.15rem;
		color: color-mix(in srgb, #f4f6fb 45%, transparent);
	}

	.live-hint {
		margin: 0;
		font-size: 0.85rem;
	}

	@media (max-width: 700px) {
		.live-activity-board {
			grid-template-columns: 1fr;
		}
	}
</style>
