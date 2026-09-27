<script lang="ts">
	import SlideOver from '$lib/components/admin/SlideOver.svelte';
	import { toast } from '$lib/components/admin/toast';
	import {
		orderBoard,
		stageAfterAction,
		type Order,
		type OrderStage
	} from '$lib/tenant/orders.svelte';

	let {
		open = $bindable(false),
		order = null as Order | null,
		stage = null as OrderStage | null
	}: {
		open?: boolean;
		order?: Order | null;
		stage?: OrderStage | null;
	} = $props();

	let cancelReason = $state('');
	let confirmingCancel = $state(false);

	const busy = $derived(order ? orderBoard.isBusy(order.id) : false);
	const canCancel = $derived(
		Boolean(order && (order.can_cancel ?? (order.status === 'PENDING' || order.status === 'ACCEPTED')))
	);

	const totalLabel = $derived(
		order && Number.isFinite(order.total) ? `₹${Math.round(order.total)}` : '—'
	);

	async function advance() {
		if (!order || !stage) return;
		try {
			await orderBoard.transition(order, stage.action);
			toast.success(`Order #${order.order_number} → ${stageAfterAction(stage.action)}`);
			open = false;
		} catch {
			toast.error('Could not update that order');
		}
	}

	async function markPaid() {
		if (!order) return;
		try {
			await orderBoard.confirmPay(order);
			toast.success(`Payment confirmed for #${order.order_number}`);
		} catch {
			toast.error('Could not confirm payment');
		}
	}

	async function cancel() {
		if (!order) return;
		try {
			await orderBoard.cancel(order, cancelReason.trim());
			toast.success(`Order #${order.order_number} cancelled`);
			confirmingCancel = false;
			cancelReason = '';
			open = false;
		} catch {
			toast.error('Could not cancel that order');
		}
	}
</script>

<SlideOver bind:open title={order ? `Order #${order.order_number}` : 'Order'}>
	{#if order}
		<div class="sod">
			<div class="sod-meta">
				<span class="sod-status">{order.status_label ?? order.status}</span>
				{#if order.created_at}
					<span class="muted">{new Date(order.created_at).toLocaleString()}</span>
				{/if}
			</div>

			<section class="sod-block">
				<h4>Customer</h4>
				<p>
					<strong>{order.customer_name || '—'}</strong>
					{#if order.customer_phone}
						<br /><span class="muted">{order.customer_phone}</span>
					{/if}
				</p>
			</section>

			<section class="sod-block">
				<h4>Items</h4>
				<ul class="sod-items">
					{#each order.items as item, i (item.product_name + '-' + i)}
						<li>
							<div class="sod-line">
								<span><b>{item.quantity}×</b> {item.product_name}</span>
								{#if item.subtotal != null}
									<span class="muted">₹{Math.round(item.subtotal)}</span>
								{/if}
							</div>
							{#if item.addons?.length}
								<ul class="sod-addons">
									{#each item.addons as addon}
										<li>+ {addon.quantity ?? 1}× {addon.name}</li>
									{/each}
								</ul>
							{/if}
							{#if item.notes}
								<p class="sod-notes muted">{item.notes}</p>
							{/if}
						</li>
					{/each}
				</ul>
				<div class="sod-total">
					<span>Total</span>
					<strong>{totalLabel}</strong>
				</div>
			</section>

			{#if order.payment}
				<section class="sod-block">
					<h4>Payment</h4>
					<p>
						{order.payment.method}
						·
						{#if order.payment.status === 'PENDING'}
							<span class="warn">Unpaid</span>
						{:else if order.payment.status === 'PAID'}
							<span class="ok">Paid</span>
						{:else}
							{order.payment.status}
						{/if}
						{#if order.payment.amount != null}
							· ₹{Math.round(order.payment.amount)}
						{/if}
					</p>
				</section>
			{/if}

			{#if confirmingCancel}
				<section class="sod-block">
					<h4>Cancel order</h4>
					<textarea
						class="input"
						rows="2"
						placeholder="Reason (optional)"
						bind:value={cancelReason}
					></textarea>
					<div class="sod-cancel-actions">
						<button class="btn btn-ghost btn-sm" type="button" onclick={() => (confirmingCancel = false)}>
							Back
						</button>
						<button class="btn btn-danger btn-sm" type="button" disabled={busy} onclick={cancel}>
							Confirm cancel
						</button>
					</div>
				</section>
			{/if}
		</div>
	{/if}

	{#snippet footer()}
		{#if order && !confirmingCancel}
			<div class="sod-foot">
				{#if stage}
					<button class="btn btn-primary" type="button" disabled={busy || !order.id} onclick={advance}>
						{stage.actionLabel}
					</button>
				{/if}
				{#if order.payment?.status === 'PENDING'}
					<button
						class="btn btn-ghost"
						type="button"
						disabled={busy || !order.payment.id}
						onclick={markPaid}
					>
						Mark paid
					</button>
				{/if}
				{#if canCancel}
					<button class="btn btn-ghost" type="button" disabled={busy} onclick={() => (confirmingCancel = true)}>
						Cancel order
					</button>
				{/if}
			</div>
		{/if}
	{/snippet}
</SlideOver>

<style>
	.sod {
		display: grid;
		gap: 1.1rem;
	}

	.sod-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.55rem;
	}

	.sod-status {
		display: inline-flex;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		background: var(--accent-soft, #eef2ff);
		color: var(--accent-dark, #3730a3);
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.sod-block h4 {
		margin: 0 0 0.4rem;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-3, var(--muted));
	}

	.sod-block p {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.45;
	}

	.sod-items {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.55rem;
	}

	.sod-line {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.9rem;
	}

	.sod-addons {
		list-style: none;
		margin: 0.2rem 0 0 1.4rem;
		padding: 0;
		font-size: 0.78rem;
		color: var(--text-3, var(--muted));
	}

	.sod-notes {
		margin: 0.2rem 0 0 1.4rem;
		font-size: 0.78rem;
	}

	.sod-total {
		display: flex;
		justify-content: space-between;
		margin-top: 0.75rem;
		padding-top: 0.65rem;
		border-top: 1px solid var(--border);
		font-size: 0.95rem;
	}

	.warn {
		color: var(--warn);
		font-weight: 650;
	}

	.ok {
		color: var(--success);
		font-weight: 650;
	}

	.sod-cancel-actions,
	.sod-foot {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.sod-foot {
		width: 100%;
	}

	textarea.input {
		width: 100%;
		resize: vertical;
		margin-bottom: 0.55rem;
	}
</style>
