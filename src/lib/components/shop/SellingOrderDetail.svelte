<script lang="ts">
	import SlideOver from '$lib/components/admin/SlideOver.svelte';
	import { toast } from '$lib/components/admin/toast';
	import PaymentChip from '$lib/components/shop/PaymentChip.svelte';
	import { ApiClientError } from '$lib/api/client';
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
	let confirmingRefund = $state(false);
	let refundReason = $state('');

	/** Only a paid online payment can be sent back through the gateway. */
	const canRefund = $derived(
		Boolean(order?.payment && order.payment.method === 'ONLINE' && order.payment.status === 'PAID')
	);

	async function refund() {
		if (!order) return;
		try {
			const { done } = await orderBoard.refund(order, refundReason.trim());
			toast.success(
				done
					? `Refund issued for #${order.order_number}`
					: `Refund for #${order.order_number} is on its way`
			);
			confirmingRefund = false;
			refundReason = '';
		} catch (err) {
			if (err instanceof ApiClientError && err.status === 403) {
				toast.error('Only the business owner can refund a payment');
			} else if (err instanceof ApiClientError && err.code === 'refund_rejected') {
				toast.error('The payment provider declined the refund. Nothing was returned.');
			} else if (err instanceof ApiClientError && err.code === 'refund_in_progress') {
				toast.error('This payment is already refunded or being refunded');
			} else {
				toast.error('Could not refund that payment');
			}
		}
	}

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
						<PaymentChip payment={order.payment} />
						· {order.payment.method === 'CASH' ? 'Cash at pickup' : 'Online'}
						{#if order.payment.amount != null}
							· ₹{Math.round(order.payment.amount)}
						{/if}
					</p>
					{#if order.payment.is_test}
						<p class="sod-note">
							Dummy payment — nobody was charged, and it is left out of your revenue.
						</p>
					{/if}
					{#if order.payment.refund_status === 'COMPLETED'}
						<p class="sod-note">
							Refunded{order.payment.refunded_amount != null ? ` ₹${Math.round(order.payment.refunded_amount)}` : ''}
							to the customer.
						</p>
					{:else if order.payment.status === 'REFUNDING'}
						<p class="sod-note">
							The refund has been sent and is settling. This updates by itself when the payment
							provider confirms.
						</p>
					{/if}
				</section>
			{/if}

			{#if confirmingRefund}
				<section class="sod-block">
					<h4>Refund payment</h4>
					<p class="sod-note">
						₹{Math.round(order.payment?.amount ?? 0)} goes back to the customer through the payment
						provider. This can't be undone.
					</p>
					<textarea
						class="input"
						rows="2"
						placeholder="Reason (optional)"
						bind:value={refundReason}
					></textarea>
					<div class="sod-cancel-actions">
						<button class="btn btn-ghost btn-sm" type="button" onclick={() => (confirmingRefund = false)}>
							Back
						</button>
						<button class="btn btn-danger btn-sm" type="button" disabled={busy} onclick={refund}>
							{busy ? 'Refunding…' : 'Refund payment'}
						</button>
					</div>
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
		{#if order && !confirmingCancel && !confirmingRefund}
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
				{#if canRefund}
					<button class="btn btn-ghost" type="button" disabled={busy} onclick={() => (confirmingRefund = true)}>
						Refund payment
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
		background: var(--icon-bg);
		color: var(--icon-fg);
		font-size: var(--fs-meta);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.sod-block h4 {
		margin: 0 0 0.4rem;
		font-size: var(--fs-meta);
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-3, var(--muted));
	}

	.sod-block p {
		margin: 0;
		font-size: var(--fs-body);
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
		font-size: var(--fs-body);
	}

	.sod-addons {
		list-style: none;
		margin: 0.2rem 0 0 1.4rem;
		padding: 0;
		font-size: var(--fs-tab);
		color: var(--text-3, var(--muted));
	}

	.sod-notes {
		margin: 0.2rem 0 0 1.4rem;
		font-size: var(--fs-tab);
	}

	.sod-total {
		display: flex;
		justify-content: space-between;
		margin-top: 0.75rem;
		padding-top: 0.65rem;
		border-top: 1px solid var(--border);
		font-size: var(--fs-title);
	}

	.sod-block p.sod-note {
		margin-top: 0.4rem;
		font-size: var(--fs-tab);
		color: var(--text-3, var(--muted));
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
