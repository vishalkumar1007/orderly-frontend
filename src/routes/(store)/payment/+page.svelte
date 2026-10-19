<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import {
		friendlyError,
		storefrontApi,
		type PaymentCheckout,
		type PaymentSession
	} from '$lib/storefront/api';
	import { customerToken } from '$lib/storefront/session.svelte';
	import { money } from '$lib/storefront/format';

	/**
	 * The payment step.
	 *
	 * The order already exists by the time this screen opens; all it does is ask
	 * the backend to start a payment and report the outcome. Every state on this
	 * screen is a state the *server* recorded: this component cannot assert that
	 * money arrived, it can only ask.
	 *
	 * Two gateways sit behind this screen, and the server picks which:
	 *  - test payments: `Start` returns a single-use token, and the buttons below
	 *    report an outcome that the server verifies;
	 *  - real payments: `Start` returns public checkout details, the gateway's
	 *    own window takes the card, and this page then only *polls*. The
	 *    gateway's signed callback to the server is what marks the order paid:
	 *    nothing this page sends can.
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
	/** The gateway window is open or we are waiting for the server to confirm. */
	let confirming = $state(false);
	let gatewayNote = $state('');
	let stillWaiting = $state(false);
	let checkout = $state<PaymentCheckout | null>(null);
	let polling = false;

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
			failed = session.payment_status === 'FAILED' || session.payment_status === 'EXPIRED';
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
			checkout = session.checkout ?? null;
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

	/* ----------------------------- real payments ----------------------------- */

	const live = $derived(session?.payment_mode === 'LIVE' || checkout !== null);

	let scriptLoading: Promise<void> | null = null;
	/** The gateway's own script, loaded only when a real payment is started. */
	function loadGatewayScript(): Promise<void> {
		if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
		if ((window as unknown as { Razorpay?: unknown }).Razorpay) return Promise.resolve();
		scriptLoading ??= new Promise<void>((resolve, reject) => {
			const el = document.createElement('script');
			el.src = 'https://checkout.razorpay.com/v1/checkout.js';
			el.async = true;
			el.onload = () => resolve();
			el.onerror = () => {
				scriptLoading = null;
				reject(new Error('gateway script failed to load'));
			};
			document.head.appendChild(el);
		});
		return scriptLoading;
	}

	/** Start (or reuse) a real payment and open the gateway window. */
	async function payNow() {
		error = '';
		gatewayNote = '';
		stillWaiting = false;
		if (!checkout) {
			method = 'ONLINE';
			await start();
			if (!checkout) return; // start() already reported why
		}
		try {
			await loadGatewayScript();
		} catch {
			error = 'The payment window could not load. Check your connection and try again.';
			return;
		}
		const c = checkout!;
		const Razorpay = (window as unknown as { Razorpay: new (o: unknown) => GatewayWindow }).Razorpay;
		const win = new Razorpay({
			key: c.key_id,
			order_id: c.order_id,
			amount: c.amount_minor,
			currency: c.currency,
			name: c.name,
			description: c.description,
			prefill: c.prefill,
			// The gateway says the customer finished; the *server* decides if it is paid.
			handler: () => void waitForServer(),
			modal: {
				ondismiss: () => {
					if (!confirming) gatewayNote = 'The payment window was closed before paying. Your order is safe.';
				}
			}
		});
		win.on('payment.failed', (r: { error?: { description?: string } }) => {
			gatewayNote = r.error?.description ?? 'That payment did not go through. You can try again.';
		});
		win.open();
	}

	type GatewayWindow = { open: () => void; on: (e: string, cb: (r: never) => void) => void };

	/**
	 * After the gateway window reports success, ask the server until it has
	 * recorded the payment. It learns from the gateway's callback, or by asking
	 * the gateway itself, so this normally settles within seconds.
	 */
	async function waitForServer() {
		if (polling) return;
		polling = true;
		confirming = true;
		stillWaiting = false;
		try {
			for (let i = 0; i < 40; i++) {
				await new Promise((r) => setTimeout(r, i === 0 ? 1200 : 3000));
				const s = await storefrontApi.paymentStatus(orderNumber, {
					phone: checkoutPhone() || undefined,
					token
				});
				session = s;
				if (s.payment_status === 'PAID') {
					await goto(`/order/${orderNumber}`, { replaceState: true });
					return;
				}
			}
			// Two minutes and still nothing: be honest rather than spin forever.
			stillWaiting = true;
		} catch (err) {
			error = friendlyError(err, 'Could not check your payment');
		} finally {
			confirming = false;
			polling = false;
		}
	}

	/** A failed payment can be retried on another enabled method. */
	const canSwitchMethod = $derived(failed && methods.length > 1);
</script>

<div class="sf-wrap" style="padding-top:16px;">
	<h1 style="margin:8px 0 4px;font-size:var(--fs-stat);font-weight:800;letter-spacing:-0.02em;">
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
			{#if session.is_test}
				<div class="sf-testbadge">Test payment: no money is charged</div>
			{/if}
		</div>

		{#if failed}
			<div class="sf-alert" data-tone="error" role="alert" style="margin-top:14px;">
				<span>
					{session.failure_reason ?? 'That payment did not go through.'}
					Your order is safe: try again or pick another way to pay.
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

		{#if live && session.payment_status !== 'PAID'}
			<div class="sf-gateway sf-gateway-live" style="margin-top:18px;">
				{#if confirming}
					<p>
						<strong>Confirming your payment…</strong><br />
						This usually takes a few seconds. Please keep this page open.
					</p>
				{:else if stillWaiting}
					<p>
						<strong>We haven't heard back from your bank yet.</strong><br />
						If you were charged, your order will update by itself: you don't need to pay again.
					</p>
					<a class="sf-btn sf-btn-secondary" href={'/order/' + orderNumber}>Check my order</a>
				{:else}
					<p>You'll pay securely in the next window. We never see your card details.</p>
					{#if gatewayNote}
						<p style="color:var(--sf-danger,#b42318);">{gatewayNote}</p>
					{/if}
					<button class="sf-btn sf-btn-primary sf-btn-lg sf-btn-block" type="button" disabled={busy} onclick={payNow}>
						{busy ? 'Starting…' : (failed ? 'Try again: ' : 'Pay ') + money(session.amount, currency)}
					</button>
				{/if}
			</div>
		{:else if session.method === 'CASH' && session.payment_status !== 'PAID'}
			<div class="sf-gateway" style="margin-top:18px;">
				<p>
					<strong>Pay at pickup.</strong> Nothing to pay now: hand over {money(session.amount, currency)}
					when you collect your order.
				</p>
				<a class="sf-btn sf-btn-primary" href={'/order/' + orderNumber}>View my order</a>
			</div>
		{:else if !failed}
			<div class="sf-gateway" style="margin-top:18px;">
				<p>
					<strong>Test payment.</strong> No real money moves: the button below reports the
					outcome to the server, which is what marks the order paid.
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
			{#if methods.includes('CASH') && session.method !== 'CASH'}
				<button
					class="sf-btn sf-btn-primary sf-btn-block"
					type="button"
					style="margin-top:10px;"
					disabled={busy}
					onclick={() => {
						method = 'CASH';
						void start();
					}}
				>
					Pay at pickup instead
				</button>
			{/if}
		{/if}

		<div style="margin-top:16px;display:grid;gap:10px;">
			{#if !live && session.method !== 'CASH'}
				<button
					class="sf-btn sf-btn-secondary sf-btn-block"
					type="button"
					disabled={busy}
					onclick={() => start()}
				>
					{failed ? 'Try again' : 'Restart payment'}
				</button>
			{/if}
			<a class="sf-btn sf-btn-ghost sf-btn-block" href={'/order/' + orderNumber}>
				Pay later at the counter
			</a>
		</div>
	{/if}
</div>
