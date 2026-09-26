<script lang="ts">
	import { goto } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import Check from '@lucide/svelte/icons/check';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import ChefHat from '@lucide/svelte/icons/chef-hat';
	import Clock from '@lucide/svelte/icons/clock';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import { friendlyError, storefrontApi, type OrderDetail } from '$lib/storefront/api';
	import { customerToken } from '$lib/storefront/session.svelte';
	import { money, minutesUntil, orderCode, timeOfDay } from '$lib/storefront/format';

	/**
	 * Order confirmation and tracking.
	 *
	 * One screen for both. The first visit is a confirmation; afterwards the same
	 * page becomes the tracker, so a customer who bookmarks an order or comes back
	 * from a notification lands in the right place without a separate route.
	 *
	 * It loads client-side because ownership is proven by a customer token from
	 * localStorage or by the checkout phone in sessionStorage, and neither exists
	 * on the server. Polling only runs while the order can still change, so a
	 * finished order is not being re-fetched in the background all evening.
	 */
	let { data } = $props();

	const config = $derived(data.config);
	const currency = $derived(config?.store?.currency ?? 'INR');
	const orderNumber = $derived(Number(data.orderNumber));

	let order = $state<OrderDetail | null>(null);
	let loading = $state(true);
	let error = $state('');
	let phonePrompt = $state(false);
	let phoneInput = $state('');
	let phoneError = $state('');
	let pollTimer: ReturnType<typeof setInterval> | null = null;

	function checkoutPhone(): string {
		try {
			return sessionStorage.getItem('orderly:checkout_phone') ?? '';
		} catch {
			return '';
		}
	}

	async function load(phone?: string) {
		const token = customerToken(data.tenantSlug ?? '');
		const usePhone = phone ?? checkoutPhone();
		try {
			const result = await storefrontApi.trackOrder(orderNumber, {
				phone: usePhone || undefined,
				token
			});
			order = result;
			error = '';
			phonePrompt = false;
			phoneError = '';
			schedulePoll();
		} catch (err) {
			const message = friendlyError(err, 'Could not load this order');
			if (message.includes('phone') || message.includes('could not find')) {
				// The server is asking for proof of ownership. Show the prompt
				// rather than an error: a guest who just ordered knows the number.
				phonePrompt = true;
				phoneError = message;
			} else {
				error = message;
			}
		} finally {
			loading = false;
		}
	}

	/**
	 * Polling only continues while the order is still moving. A completed or
	 * cancelled order is final, so there is nothing to keep asking about.
	 */
	function schedulePoll() {
		if (pollTimer) clearInterval(pollTimer);
		if (!order?.is_active) return;
		pollTimer = setInterval(() => {
			// Skip a poll while the tab is hidden; there is nobody watching.
			if (typeof document !== 'undefined' && document.hidden) return;
			void load();
		}, 12000);
	}

	function submitPhone(event: SubmitEvent) {
		event.preventDefault();
		if (phoneInput.trim().length < 8) {
			phoneError = 'Enter the phone number you used to order';
			return;
		}
		phoneError = '';
		loading = true;
		void load(phoneInput.trim());
	}

	onMount(() => {
		void load();
	});

	onDestroy(() => {
		if (pollTimer) clearInterval(pollTimer);
	});

	async function payNow() {
		await goto(`/payment?order=${orderNumber}`);
	}

	async function orderAgain() {
		await goto('/menu');
	}

	const totals = $derived(order?.totals ?? null);
	const currentStep = $derived(order?.timeline?.find((s) => s.state === 'CURRENT'));
	const isCancelled = $derived(order?.status === 'CANCELLED');
	const isCompleted = $derived(order?.status === 'COMPLETED');
	const isReady = $derived(order?.status === 'READY');
</script>

<div class="sf-wrap" style="padding-top:18px;">
	{#if loading}
		<div style="display:grid;gap:12px;">
			<div class="sf-skeleton" style="height:150px;border-radius:var(--sf-radius);"></div>
			<div class="sf-skeleton" style="height:200px;border-radius:var(--sf-radius);"></div>
		</div>
	{:else if phonePrompt}
		<div class="sf-card" style="padding:20px;">
			<h1 style="margin:0 0 6px;font-size:1.125rem;font-weight:750;">Confirm it's your order</h1>
			<p style="margin:0 0 16px;font-size:0.875rem;color:var(--sf-text-2);line-height:1.5;">
				Enter the phone number you used to place order #{orderNumber}.
			</p>
			<form onsubmit={submitPhone}>
				<label class="sf-field">
					<span class="sf-label">Phone number</span>
					<input
						class="sf-input"
						type="tel"
						inputmode="tel"
						bind:value={phoneInput}
						autocomplete="tel"
						enterkeyhint="go"
						placeholder="98765 43210"
					/>
				</label>
				{#if phoneError}
					<p class="sf-field-error" style="margin-top:-6px;">{phoneError}</p>
				{/if}
				<button class="sf-btn sf-btn-primary sf-btn-block" type="submit">Show my order</button>
			</form>
		</div>
	{:else if error || !order}
		<div class="sf-alert" data-tone="error" role="alert">
			<span>{error || 'We could not load this order.'}</span>
		</div>
		<div style="margin-top:14px;">
			<a class="sf-btn sf-btn-secondary sf-btn-block" href="/orders">Find your orders</a>
		</div>
	{:else}
		<!-- Status -->
		<div class="sf-status-hero">
			<span
				class="sf-status-mark"
				data-tone={isCancelled ? 'cancelled' : isCompleted || isReady ? 'ok' : 'wait'}
				aria-hidden="true"
			>
				{#if isCancelled}
					<CircleX size={32} strokeWidth={1.9} />
				{:else if isCompleted || isReady}
					<CircleCheck size={32} strokeWidth={1.9} />
				{:else}
					<ChefHat size={32} strokeWidth={1.9} />
				{/if}
			</span>
			<h1>
				{isCancelled
					? 'Order cancelled'
					: isCompleted
						? 'Collected — thank you'
						: isReady
							? 'Ready for pickup'
							: 'Order placed'}
			</h1>
			<p>
				{#if isCancelled}
					This order will not be prepared.
				{:else if isCompleted}
					We hope it was good.
				{:else if isReady}
					Come to the counter and ask for your order.
				{:else if order.estimated_ready_at}
					Ready {minutesUntil(order.estimated_ready_at)}
				{:else}
					We'll text you when it is ready
				{/if}
			</p>
			<span class="sf-order-code">
				<strong>{orderCode(order.reference, order.order_number)}</strong>
			</span>
		</div>

		{#if order.payment_required}
			<div class="sf-alert" data-tone="info" role="status">
				<span>
					Payment of {money(order.payment?.amount ?? totals?.total ?? 0, currency)} is still due.
				</span>
			</div>
			<button
				class="sf-btn sf-btn-primary sf-btn-block"
				type="button"
				style="margin-top:10px;"
				onclick={payNow}
			>
				Pay now
			</button>
		{:else if order.pay_at_pickup}
			<div class="sf-alert" data-tone="info" role="status">
				<span>Pay {money(totals?.total ?? 0, currency)} at the counter when you collect.</span>
			</div>
		{/if}

		<!-- Timeline -->
		<ol class="sf-timeline" style="margin-top:22px;">
			{#each order.timeline as step (step.key)}
				<li data-state={step.state}>
					<span class="sf-timeline-dot" data-pulse={String(step.state === 'CURRENT' && !isCancelled)} aria-hidden="true">
						<Check size={13} strokeWidth={3.2} />
					</span>
					<span class="sf-timeline-body">
						<span class="sf-timeline-label">{step.label}</span>
						{#if step.at}
							<span class="sf-timeline-time">{timeOfDay(step.at)}</span>
						{/if}
					</span>
				</li>
			{/each}
		</ol>

		<!-- Items -->
		<div class="sf-panel" style="margin-top:22px;">
			<div class="sf-section-head" style="padding:0;margin-bottom:2px;">
				<h2 style="font-size:0.9375rem;">Your order</h2>
				<span style="font-size:0.75rem;color:var(--sf-text-3);">
					{order.items.length} {order.items.length === 1 ? 'item' : 'items'}
				</span>
			</div>
			{#each order.items as item (item.id ?? item.name)}
				<div class="sf-total-row" style="padding:8px 0;align-items:flex-start;">
					<span style="min-width:0;">
						{item.quantity} × {item.name}
						{#if item.addons?.length}
							<span style="display:block;font-size:0.75rem;color:var(--sf-text-3);">
								{item.addons.map((a) => (a.quantity > 1 ? `${a.quantity}× ` : '') + a.name).join(', ')}
							</span>
						{/if}
						{#if item.notes}
							<span style="display:block;font-size:0.75rem;color:var(--sf-text-3);font-style:italic;">
								“{item.notes}”
							</span>
						{/if}
					</span>
					<span>{money(item.subtotal, currency)}</span>
				</div>
			{/each}
			<div class="sf-totals">
				<div class="sf-total-row"><span>Subtotal</span><span>{money(totals?.subtotal ?? 0, currency)}</span></div>
				{#if (totals?.tax ?? 0) > 0}
					<div class="sf-total-row"><span>Tax</span><span>{money(totals?.tax ?? 0, currency)}</span></div>
				{/if}
				{#if (totals?.packaging_fee ?? 0) > 0}
					<div class="sf-total-row">
						<span>Packaging</span><span>{money(totals?.packaging_fee ?? 0, currency)}</span>
					</div>
				{/if}
				<div class="sf-total-row" data-strong="true">
					<span>Total</span>
					<span>{money(totals?.total ?? 0, currency)}</span>
				</div>
			</div>
		</div>

		<!-- Pickup -->
		<div class="sf-panel" style="margin-top:12px;">
			<div class="sf-section-head" style="padding:0;margin-bottom:8px;">
				<h2 style="font-size:0.9375rem;">Pickup</h2>
			</div>
			<div class="sf-info-list">
				<div class="sf-info-row">
					<MapPin size={17} strokeWidth={1.9} aria-hidden="true" />
					<span>{order.store.address || config?.store?.address || 'Collect from the counter'}</span>
				</div>
				{#if order.estimated_ready_at && !isCompleted && !isCancelled}
					<div class="sf-info-row">
						<Clock size={17} strokeWidth={1.9} aria-hidden="true" />
						<span>Expected {timeOfDay(order.estimated_ready_at)}</span>
					</div>
				{/if}
			</div>
			{#if order.payment}
				<div class="sf-total-row" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--sf-border);">
					<span>
						Payment
						<span
							class="sf-tag"
							data-tone={order.payment.status === 'PAID' ? 'veg' : undefined}
							style="margin-left:6px;"
						>
							{order.payment.status}
						</span>
					</span>
					<span>
						{order.payment.method === 'CASH' ? 'Cash at pickup' : 'Online'} ·{' '}
						{money(order.payment.amount, currency)}
					</span>
				</div>
			{/if}
		</div>

		<div style="margin-top:18px;display:grid;gap:10px;">
			<button
				class="sf-btn sf-btn-secondary sf-btn-block"
				type="button"
				onclick={() => load()}
				disabled={loading}
			>
				<RefreshCw size={16} strokeWidth={2} aria-hidden="true" />
				Refresh
			</button>
			<button class="sf-btn sf-btn-primary sf-btn-block" type="button" onclick={orderAgain}>
				Order again
			</button>
			<a class="sf-btn sf-btn-ghost sf-btn-block" href="/orders">All your orders</a>
		</div>
	{/if}
</div>
