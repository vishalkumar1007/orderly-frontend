<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { friendlyError, storefrontApi, type PaymentSession } from '$lib/storefront/api';
	import { customerToken } from '$lib/storefront/session.svelte';
	import { money } from '$lib/storefront/format';

	/**
	 * The payment step.
	 *
	 * The order already exists by the time this screen opens; all it does is ask
	 * the backend to start a payment and report the outcome. Every state on this
	 * screen is a state the *server* recorded — this component cannot assert that
	 * money arrived, it can only ask.
	 *
	 * The gateway below is a sandbox. `Start` returns a single-use token that has
	 * to be presented to confirm, which is the same shape a real provider's
	 * signed webhook would give, so swapping in a live PSP does not change this
	 * page's contract.
	 */
	let { data } = $props();

	const config = $derived(data.config);
	const currency = $derived(config?.store?.currency ?? 'INR');
	const orderNumber = $derived(Number($page.url.searchParams.get('order') ?? 0));
	const methods = $derived(config?.payments.methods ?? []);

	let session = $state<PaymentSession | null>(null);
	let loading = $state(true);
	let busy = $state(false);
	let error = $state('');
	let failed = $state(false);
	let method = $state('ONLINE');

	/**
	 * A guest proves ownership with the phone they checked out with. It is kept in
	 * sessionStorage for the length of the checkout so a refresh does not lose the
	 * ability to finish paying.
	 */
	function checkoutPhone(): string {
		try {
			return sessionStorage.getItem('orderly:checkout_phone') ?? '';
		} catch {
			return '';
		}
	}

	const token = $derived(customerToken(data.tenantSlug ?? ''));

	onMount(async () => {
		if (!orderNumber) {
			await goto('/menu', { replaceState: true });
			return;
		}
		method = methods.includes('ONLINE') ? 'ONLINE' : (methods[0] ?? 'ONLINE');
		await load();
	});

	async function load() {
		loading = true;
		error = '';
		try {
			session = await storefrontApi.paymentStatus(orderNumber, {
				phone: checkoutPhone() || undefined,
				token
			});
			failed = session.payment_status === 'FAILED';
			if (session.payment_status === 'PAID') {
				await goto(`/order/${orderNumber}`, { replaceState: true });
			}
		} catch (err) {
			error = friendlyError(err, 'Could not load this payment');
		} finally {
			loading = false;
		}
	}

	async function start() {
		busy = true;
		error = '';
		failed = false;
		try {
			session = await storefrontApi.startPayment(orderNumber, method, {
				phone: checkoutPhone() || undefined,
				token
			});
			if (session.payment_status === 'PAID') {
				await goto(`/order/${orderNumber}`, { replaceState: true });
			}
		} catch (err) {
			error = friendlyError(err, 'Could not start the payment');
		} finally {
			busy = false;
		}
	}

	async function confirm(outcome: 'SUCCESS' | 'FAILURE') {
		if (!session?.payment_token) return;
		busy = true;
		error = '';
		try {
			session = await storefrontApi.confirmPayment(
				orderNumber,
				{
					outcome,
					token: session.payment_token,
					...(outcome === 'FAILURE' ? { reason: 'Payment was declined' } : {}),
					...(checkoutPhone() ? { phone: checkoutPhone() } : {}),
				},
				token
			);
			if (session.payment_status === 'PAID') {
				await goto(`/order/${orderNumber}`, { replaceState: true });
				return;
			}
			failed = true;
		} catch (err) {
			error = friendlyError(err, 'Could not complete the payment');
		} finally {
			busy = false;
		}
	}

	/** A failed payment can be retried on another enabled method. */
	const canSwitchMethod = $derived(failed && methods.length > 1);
</script>

<div class="sf-wrap" style="padding-top:16px;">
	<h1 style="margin:8px 0 4px;font-size:1.375rem;font-weight:800;letter-spacing:-0.02em;">
		Payment
	</h1>

	{#if loading}
		<div style="display:grid;gap:10px;margin-top:16px;">
			<div class="sf-skeleton" style="height:96px;"></div>
			<div class="sf-skeleton" style="height:120px;"></div>
		</div>
	{:else if error && !session}
		<div class="sf-alert" data-tone="error" role="alert" style="margin-top:16px;">
			<span>{error}</span>
		</div>
		<div style="margin-top:14px;display:grid;gap:10px;">
			<a class="sf-btn sf-btn-secondary sf-btn-block" href={'/order/' + orderNumber}>
				Back to the order
			</a>
		</div>
	{:else if session}
		<div class="sf-card sf-pay-amount" style="margin-top:14px;">
			<strong>{money(session.amount, currency)}</strong>
			<span>
				Order #{session.order_number} · {config?.store?.name}
			</span>
		</div>

		{#if failed}
			<div class="sf-alert" data-tone="error" role="alert" style="margin-top:14px;">
				<span>
					{session.failure_reason ?? 'That payment did not go through.'}
					Your order is safe — try again or pick another way to pay.
				</span>
			</div>
		{:else if session.payment_status === 'PENDING'}
			<div class="sf-alert" data-tone="info" role="status" style="margin-top:14px;">
				<span>Payment started. Complete it below to confirm your order.</span>
			</div>
		{/if}

		{#if canSwitchMethod}
			<h2 class="sf-group-title">Try another way to pay</h2>
			<div style="display:grid;gap:8px;">
				{#each methods as option (option)}
					<button
						class="sf-choice"
						type="button"
						aria-pressed={method === option}
						onclick={() => (method = option)}
					>
						<span class="sf-choice-mark" aria-hidden="true"></span>
						<span class="sf-choice-body">
							<span class="sf-choice-title">
								{option === 'ONLINE' ? 'Pay online' : 'Cash at pickup'}
							</span>
							<span class="sf-choice-hint">
								{option === 'ONLINE'
									? 'UPI, card or net banking'
									: 'Pay when you collect your order'}
							</span>
						</span>
					</button>
				{/each}
			</div>
			<button
				class="sf-btn sf-btn-primary sf-btn-lg sf-btn-block"
				type="button"
				style="margin-top:14px;"
				disabled={busy}
				onclick={start}
			>
				{busy ? 'Starting…' : method === 'CASH' ? 'Choose cash at pickup' : 'Pay ' + money(session.amount, currency)}
			</button>
		{/if}

		{#if !failed}
			<div class="sf-gateway" style="margin-top:18px;">
				<p>
					<strong>Sandbox payment gateway.</strong> No real money moves in this build — the
					button below reports the outcome to the server, which is what marks the order paid.
				</p>
				<div class="sf-btn-row">
					<button
						class="sf-btn sf-btn-secondary"
						type="button"
						disabled={busy || !session.payment_token}
						onclick={() => confirm('FAILURE')}
					>
						Simulate failure
					</button>
					<button
						class="sf-btn sf-btn-primary"
						type="button"
						disabled={busy || !session.payment_token}
						onclick={() => confirm('SUCCESS')}
					>
						{busy ? 'Working…' : 'Pay ' + money(session.amount, currency)}
					</button>
				</div>
			</div>
		{/if}

		{#if error}
			<div class="sf-alert" data-tone="error" role="alert" style="margin-top:14px;">
				<span>{error}</span>
			</div>
		{/if}

		<div style="margin-top:16px;display:grid;gap:10px;">
			<button
				class="sf-btn sf-btn-secondary sf-btn-block"
				type="button"
				disabled={busy}
				onclick={() => start()}
			>
				{failed ? 'Try again' : 'Restart payment'}
			</button>
			<a class="sf-btn sf-btn-ghost sf-btn-block" href={'/order/' + orderNumber}>
				Pay later at the counter
			</a>
		</div>
	{/if}
</div>
