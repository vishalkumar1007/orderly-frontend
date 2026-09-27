<script lang="ts">
	import type { Order, OrderStage } from '$lib/tenant/orders.svelte';
	import { orderBoard, stageAfterAction } from '$lib/tenant/orders.svelte';
	import { toast } from '$lib/components/admin/toast';

	let {
		order,
		/** The stage this card is being shown under; supplies the next action. */
		stage,
		/** Hide the primary action where the screen handles it elsewhere. */
		actionable = true,
		onclick
	}: {
		order: Order;
		stage: OrderStage;
		actionable?: boolean;
		onclick?: () => void;
	} = $props();

	const busy = $derived(orderBoard.isBusy(order.id));
	const itemCount = $derived(order.items.reduce((n, i) => n + i.quantity, 0));

	/** "4m ago" style stamp, falling back to nothing if the API omitted it. */
	const when = $derived.by(() => {
		if (!order.created_at) return '';
		const then = new Date(order.created_at).getTime();
		if (Number.isNaN(then)) return '';
		const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hrs = Math.round(mins / 60);
		if (hrs < 24) return `${hrs}h ago`;
		return `${Math.round(hrs / 24)}d ago`;
	});

	const totalLabel = $derived(
		Number.isFinite(order.total) ? `₹${Math.round(order.total)}` : '—'
	);

	async function advance(e: MouseEvent) {
		e.stopPropagation();
		try {
			await orderBoard.transition(order, stage.action);
			toast.success(`Order #${order.order_number} → ${stageAfterAction(stage.action)}`);
		} catch {
			toast.error('Could not update that order');
		}
	}

	async function markPaid(e: MouseEvent) {
		e.stopPropagation();
		try {
			await orderBoard.confirmPay(order);
			toast.success(`Payment confirmed for #${order.order_number}`);
		} catch {
			toast.error('Could not confirm payment');
		}
	}
</script>

<article
	class="osorder"
	class:osorder-clickable={Boolean(onclick)}
	aria-busy={busy}
	role={onclick ? 'button' : undefined}
	tabindex={onclick ? 0 : undefined}
	onclick={onclick}
	onkeydown={(e) => {
		if (!onclick) return;
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onclick();
		}
	}}
>
	<div class="osorder-head">
		<span class="osorder-num">#{order.order_number}</span>
		{#if when}<span class="osorder-when">{when}</span>{/if}
	</div>

	<ul class="osorder-items">
		{#each order.items as item, i (item.product_name + '-' + i)}
			<li>
				<span class="osorder-qty">{item.quantity}×</span>
				<span>{item.product_name}</span>
			</li>
		{/each}
	</ul>

	<div class="osorder-foot">
		<span class="osorder-total">{totalLabel}</span>
		{#if order.payment}
			<span class="osorder-meta">
				{order.payment.method}
				{#if order.payment.status === 'PENDING'}
					· <span class="osorder-unpaid">unpaid</span>
				{:else if order.payment.status === 'PAID'}
					· <span class="osorder-paid">paid</span>
				{/if}
			</span>
		{/if}
		<span class="osorder-meta">{itemCount} item{itemCount === 1 ? '' : 's'}</span>
		{#if order.customer_name}
			<span class="osorder-meta">· {order.customer_name}</span>
		{/if}
	</div>

	{#if actionable}
		<div class="osorder-actions">
			<button class="btn btn-primary" type="button" disabled={busy || !order.id} onclick={advance}>
				{stage.actionLabel}
			</button>
			{#if order.payment && order.payment.status === 'PENDING'}
				<button
					class="btn btn-ghost"
					type="button"
					disabled={busy || !order.payment.id}
					onclick={markPaid}
				>
					Mark paid
				</button>
			{/if}
		</div>
	{/if}
</article>

<style>
	.osorder-clickable {
		cursor: pointer;
	}

	.osorder-clickable:focus-visible {
		outline: 2px solid var(--accent, #3b82f6);
		outline-offset: 2px;
	}

	.osorder-unpaid {
		color: var(--warn);
		font-weight: 650;
	}

	.osorder-paid {
		color: var(--success);
		font-weight: 650;
	}
</style>
