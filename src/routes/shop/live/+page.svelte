<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import MonitorPlay from '@lucide/svelte/icons/monitor-play';
	import PauseCircle from '@lucide/svelte/icons/pause-circle';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Settings2 from '@lucide/svelte/icons/settings-2';
	import OpsFullscreenToggle from '$lib/components/admin/OpsFullscreenToggle.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import { orderBoard } from '$lib/tenant/orders.svelte';
	import {
		liveDisplay,
		loadLiveDisplay,
		minutesSince,
		publicName,
		saveLiveDisplay,
		setColumn
	} from '$lib/tenant/liveDisplay.svelte';
	import { hasBusinessModule, terms } from '$lib/tenant/businessType.svelte';
	import EmptyState from '$lib/components/admin/EmptyState.svelte';

	/**
	 * Some businesses have nobody waiting at a counter. A hotel delivers to the
	 * room and a grocer hands over a packed order by name, so a public "now
	 * serving" board has nothing to display. The navigation already leaves it
	 * out for those types; this is the direct-link case, and it explains itself
	 * rather than showing an empty screen that looks broken.
	 */
	const available = $derived(hasBusinessModule('live_display'));
	const t = $derived(terms());

	/**
	 * The customer-facing pickup display.
	 *
	 * It is a public screen, so what appears on it is a decision rather than a
	 * default: names are off unless the shop turns them on, and then only the
	 * first name. The settings belong to this device — the TV over the counter
	 * and the tablet by the door can show different things.
	 */

	const fullscreen = $derived($page.url.searchParams.get('fullscreen') === '1');

	onMount(() => {
		loadLiveDisplay();
		orderBoard.acquire('ops');
		return () => orderBoard.release('ops');
	});

	let controlsOpen = $state(false);

	const preparing = $derived(orderBoard.forStage('PREPARING'));
	const ready = $derived(orderBoard.forStage('READY'));
	const columns = $derived(
		[liveDisplay.showPreparing, liveDisplay.showReady].filter(Boolean).length
	);

	/** The line under a ticket number, or "" when nothing is enabled. */
	function ticketMeta(order: { customer_name: string; created_at?: string }): string {
		const parts: string[] = [];
		if (liveDisplay.showCustomerName && order.customer_name) {
			parts.push(publicName(order.customer_name));
		}
		if (liveDisplay.showWaitTime) {
			const minutes = minutesSince(order.created_at);
			if (minutes !== null) parts.push(minutes === 0 ? 'just now' : `${minutes} min`);
		}
		return parts.join(' · ');
	}
</script>

{#if !available}
	<div class="panel">
		<EmptyState
			title="No pickup display for this kind of business"
			description={`${t.orders} here are handed over directly rather than called from a queue, so there is no public board to show. Use the ${t.station.toLowerCase()} board to follow work in progress.`}
		>
			{#snippet action()}
				<a class="btn btn-primary" href="/shop/kitchen">Open the {t.station.toLowerCase()} board</a>
			{/snippet}
		</EmptyState>
	</div>
{:else}
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
		<div class="live-activity-actions">
			{#if !fullscreen}
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					aria-expanded={controlsOpen}
					onclick={() => (controlsOpen = !controlsOpen)}
				>
					<Settings2 size={14} strokeWidth={2} />
					Display settings
				</button>
				<button
					type="button"
					class="btn btn-quiet btn-sm"
					onclick={() => void orderBoard.refresh()}
				>
					<RefreshCw size={13} strokeWidth={2} />
					Refresh
				</button>
			{/if}
			<OpsFullscreenToggle label="Fullscreen" />
		</div>
	</header>

	{#if controlsOpen && !fullscreen}
		<section class="live-controls panel" aria-label="Display settings">
			<div class="live-controls-grid">
				<div>
					<p class="field-label">What this screen shows</p>
					<div class="live-controls-stack">
						<Switch
							checked={liveDisplay.showPreparing}
							label="Preparing column"
							onchange={(v) => setColumn('preparing', v)}
						/>
						<Switch
							checked={liveDisplay.showReady}
							label="Ready column"
							onchange={(v) => setColumn('ready', v)}
						/>
					</div>
				</div>

				<div>
					<p class="field-label">Information on each ticket</p>
					<div class="live-controls-stack">
						<Switch
							bind:checked={liveDisplay.showCustomerName}
							label="Customer first name"
							hint="A pickup screen is public — surnames and phone numbers are never shown."
							onchange={saveLiveDisplay}
						/>
						<Switch
							bind:checked={liveDisplay.showWaitTime}
							label="Time since the order arrived"
							onchange={saveLiveDisplay}
						/>
					</div>
				</div>

				<div>
					<p class="field-label">Ticket size</p>
					<div class="mode-seg" role="radiogroup" aria-label="Ticket size">
						{#each [{ id: 'comfortable', label: 'Comfortable' }, { id: 'large', label: 'Large' }] as option (option.id)}
							<button
								type="button"
								class={liveDisplay.ticketSize === option.id ? 'active' : ''}
								role="radio"
								aria-checked={liveDisplay.ticketSize === option.id}
								onclick={() => {
									liveDisplay.ticketSize = option.id as 'comfortable' | 'large';
									saveLiveDisplay();
								}}
							>
								{option.label}
							</button>
						{/each}
					</div>
					<p class="field-hint" style="margin-top:0.5rem;">
						Large suits a TV read from across the room.
					</p>
				</div>

				<div>
					<p class="field-label">Display</p>
					<div class="live-controls-stack">
						<Switch
							bind:checked={liveDisplay.paused}
							label="Pause the display"
							hint="Blanks the board with a closed notice, without stopping orders."
							onchange={saveLiveDisplay}
						/>
					</div>
					<p class="field-hint" style="margin-top:0.5rem;">
						These settings belong to this device, so each screen can differ. Orders refresh
						automatically every few seconds.
					</p>
				</div>
			</div>
		</section>
	{/if}

	{#if orderBoard.error}
		<div class="osh-banner offline">
			<span>{orderBoard.error}</span>
			<span class="osh-banner-spacer"></span>
			<button class="btn btn-quiet btn-sm" onclick={() => void orderBoard.refresh()}>Retry</button>
		</div>
	{/if}

	{#if liveDisplay.paused}
		<div class="live-paused">
			<PauseCircle size={fullscreen ? 44 : 28} strokeWidth={1.6} />
			<strong>Display paused</strong>
			<p>Orders are still being taken — this screen is simply not showing them.</p>
		</div>
	{:else}
		<div
			class={['live-activity-board', columns === 1 ? 'live-board-single' : ''].join(' ')}
			data-size={liveDisplay.ticketSize}
			aria-live="polite"
		>
			{#if liveDisplay.showPreparing}
				<section class="live-col">
					<h2>Preparing</h2>
					{#if preparing.length === 0}
						<p class="live-empty">No orders preparing</p>
					{:else}
						<ul>
							{#each preparing as order (order.id)}
								{@const meta = ticketMeta(order)}
								<li class="live-ticket">
									<span class="live-ticket-num">#{order.order_number}</span>
									{#if meta}<span class="live-ticket-meta">{meta}</span>{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/if}
			{#if liveDisplay.showReady}
				<section class="live-col live-col-ready">
					<h2>Ready</h2>
					{#if ready.length === 0}
						<p class="live-empty">Waiting for ready orders</p>
					{:else}
						<ul>
							{#each ready as order (order.id)}
								{@const meta = ticketMeta(order)}
								<li class="live-ticket live-ticket-ready">
									<span class="live-ticket-num">#{order.order_number}</span>
									{#if meta}<span class="live-ticket-meta">{meta}</span>{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/if}
		</div>
	{/if}

	{#if !fullscreen && preparing.length === 0 && ready.length === 0 && !orderBoard.error}
		<p class="muted live-hint">
			When orders are in kitchen stages, ticket numbers appear here for customers to watch.
			Use Fullscreen for a dedicated display.
		</p>
	{/if}
</div>
{/if}

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
		font-size: var(--fs-title);
		font-weight: 700;
	}

	.live-activity-fs .live-activity-brand strong {
		font-size: var(--fs-stat);
		letter-spacing: 0.02em;
	}

	.live-activity-brand p {
		margin: 0.2rem 0 0;
		font-size: var(--fs-body);
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
		font-size: var(--fs-code);
		font-weight: 750;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted, var(--text-2));
	}

	.live-activity-fs .live-col h2 {
		font-size: var(--fs-title);
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
		font-size: var(--fs-h1);
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
		font-size: var(--fs-body);
		color: var(--muted, var(--text-2));
	}

	.live-activity-fs .live-empty {
		font-size: var(--fs-h1);
		color: color-mix(in srgb, #f4f6fb 45%, transparent);
	}

	.live-hint {
		margin: 0;
		font-size: var(--fs-body);
	}

	.live-activity-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.live-controls {
		padding: 1rem 1.15rem;
	}

	.live-controls-grid {
		display: grid;
		gap: 1.25rem;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
	}

	.live-controls-stack {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin-top: 0.5rem;
	}

	.live-board-single {
		grid-template-columns: 1fr;
	}

	.live-ticket {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.live-ticket-num {
		font-variant-numeric: tabular-nums;
	}

	.live-ticket-meta {
		font-size: var(--fs-code);
		font-weight: 550;
		color: var(--text-3);
		white-space: nowrap;
	}

	.live-activity-fs .live-ticket-meta {
		font-size: clamp(0.9rem, 1.6vw, 1.25rem);
		color: color-mix(in srgb, #f4f6fb 60%, transparent);
	}

	.live-activity-board[data-size='large'] .live-ticket {
		font-size: var(--fs-display);
		padding: 0.9rem 1.1rem;
	}

	.live-activity-fs .live-activity-board[data-size='large'] .live-ticket {
		font-size: clamp(2.25rem, 6vw, 4.5rem);
	}

	.live-paused {
		display: grid;
		justify-items: center;
		align-content: center;
		gap: 0.5rem;
		min-height: 16rem;
		border: 1px dashed var(--border);
		border-radius: var(--radius-lg, 14px);
		padding: 2rem;
		text-align: center;
		color: var(--text-3);
	}

	.live-activity-fs .live-paused {
		min-height: calc(100dvh - 8rem);
		border-color: rgba(255, 255, 255, 0.12);
	}

	.live-paused strong {
		font-size: var(--fs-title);
		font-weight: 700;
		color: var(--text);
	}

	.live-activity-fs .live-paused strong {
		color: #f4f6fb;
		font-size: var(--fs-stat);
	}

	.live-paused p {
		margin: 0;
		font-size: var(--fs-body);
		max-width: 26rem;
	}

	@media (max-width: 700px) {
		.live-activity-board {
			grid-template-columns: 1fr;
		}
	}
</style>
