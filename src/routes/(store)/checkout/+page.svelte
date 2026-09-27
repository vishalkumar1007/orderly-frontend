<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Lock from '@lucide/svelte/icons/lock';
	import { useCart } from '$lib/storefront/cart-state.svelte';
	import { lineTotal, quoteRequest } from '$lib/storefront/cart.svelte';
	import { friendlyError, storefrontApi, type OrderDetail } from '$lib/storefront/api';
	import { ApiClientError } from '$lib/api/client';
	import { customerSession, customerToken, isSignedIn } from '$lib/storefront/session.svelte';
	import { formatPhone, money } from '$lib/storefront/format';

	/**
	 * Checkout.
	 *
	 * Three things and a button: who you are, how you collect, how you pay. A
	 * guest is never pushed to sign in — the phone shortcut is offered once, as a
	 * plain secondary link, and can be ignored.
	 *
	 * The order is priced by the server on submit. This screen shows a quote for
	 * reassurance, but the amount that appears on the confirmation is the one the
	 * backend computed, and that is the one the payment step charges.
	 */
	let { data } = $props();

	const cart = useCart();
	const config = $derived(data.config);
	const currency = $derived(config?.store?.currency ?? 'INR');
	const methods = $derived(config?.payments.methods ?? []);
	const orderable = $derived(config?.ordering.enabled ?? false);
	const orderType = 'PICKUP';

	let name = $state('');
	let phone = $state('');
	let email = $state('');
	let notes = $state('');
	let method = $state('');
	let placing = $state(false);
	let error = $state('');
	let fieldErrors = $state<Record<string, string>>({});
	let signedIn = $state(false);
	let clientToken = $state('');

	onMount(() => {
		const session = customerSession.load(data.tenantSlug ?? '');
		signedIn = Boolean(session);
		const loginMode =
			config?.ordering?.customer_login_mode ??
			(config?.ordering?.customer_login ? 'optional' : 'off');
		if (loginMode === 'required' && !session) {
			const next = encodeURIComponent('/checkout');
			void goto(`/login?next=${next}`);
			return;
		}
		if (session?.customer) {
			if (session.customer.name && session.customer.name !== 'Guest customer') {
				name = session.customer.name;
			}
			phone = session.customer.phone_full ?? '';
		}
		// A signed-in customer has no need to pick a method again, but a guest
		// gets the tenant's default preselected so the common case is one tap.
		method = methods[0] ?? '';
		// One idempotency key per checkout session. A double tap, a refresh or a
		// retry after a network blip reuses it, so the backend returns the
		// original order instead of placing a second.
		clientToken = crypto.randomUUID();
	});

	$effect(() => {
		if (method || !methods.length) return;
		method = methods[0];
	});

	async function refreshQuote() {
		if (!cart.lines.length) return;
		try {
			const quote = await storefrontApi.quote(quoteRequest(cart.lines));
			cart.setTotals(quote.totals);
		} catch {
			// Not fatal: the server prices the order on submit.
		}
	}

	$effect(() => {
		void cart.lines.length;
		refreshQuote();
	});

	const totals = $derived(cart.estimate());

	/** `validate` is the client-side mirror of the server's rules. It exists to
	 *  save a round trip, not to be the authority. */
	function validate(): boolean {
		const next: Record<string, string> = {};
		if (name.trim().length < 2) next.name = 'Tell us your name';
		const digits = phone.replace(/[^\d]/g, '');
		if (digits.length < 8) next.phone = 'Enter a phone number we can reach you on';
		if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
			next.email = 'Check this email address';
		}
		if (!method) next.method = 'Choose how you would like to pay';
		fieldErrors = next;
		return Object.keys(next).length === 0;
	}

	async function placeOrder(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		if (!validate()) return;
		placing = true;
		try {
			const result: OrderDetail = await storefrontApi.createOrder(
				{
					customer_name: name.trim(),
					customer_phone: phone.trim(),
					...(email.trim() ? { customer_email: email.trim() } : {}),
					...(notes.trim() ? { notes: notes.trim() } : {}),
					payment_method: method,
					client_token: clientToken,
					items: quoteRequest(cart.lines)
				},
				customerToken(data.tenantSlug ?? '')
			);
			// The cart is only cleared once the order exists, so a failure leaves
			// the customer exactly where they were.
			cart.empty();
			// A guest proves ownership of their order on the payment and tracking
			// screens with the checkout phone. It is kept for this browser session
			// only, and is not a credential the server trusts on its own.
			try {
				sessionStorage.setItem('orderly:checkout_phone', phone.trim());
			} catch {
				// Private mode: the payment screen will ask for the phone instead.
			}
			if (result.next_step === 'pay' && result.can_pay_online) {
				await goto(`/payment?order=${result.order_number}`);
			} else {
				await goto(`/order/${result.order_number}`);
			}
		} catch (err) {
			error = friendlyError(err, 'We could not place your order. Please try again.');
			if (err instanceof ApiClientError && err.code === 'login_required') {
				const next = encodeURIComponent('/checkout');
				await goto(`/login?next=${next}`);
				return;
			}
			placing = false;
		}
	}

	const methodLabel: Record<string, string> = {
		ONLINE: 'Pay online',
		CASH: 'Cash at pickup'
	};
	const methodHint: Record<string, string> = {
		ONLINE: 'UPI, card or net banking',
		CASH: 'Pay when you collect your order'
	};
</script>

<div class="sf-wrap" style="padding-top:16px;">
	<a
		href="/cart"
		style="display:inline-flex;align-items:center;gap:4px;padding:8px 0;font-size:0.8125rem;font-weight:600;color:var(--sf-text-2);text-decoration:none;"
	>
		<ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" />
		Cart
	</a>

	{#if cart.lines.length === 0}
		<div class="sf-empty">
			<h3>Nothing to check out</h3>
			<p>Your cart is empty.</p>
			<a class="sf-btn sf-btn-primary" href="/menu">Browse the menu</a>
		</div>
	{:else}
		<form onsubmit={placeOrder} novalidate>
			<h1 style="margin:10px 0 16px;font-size:1.375rem;font-weight:800;letter-spacing:-0.02em;">
				Checkout
			</h1>

			{#if !orderable}
				<div class="sf-alert" data-tone="warn" role="status" style="margin-bottom:16px;">
					<span>{config?.ordering.closed_reason || 'Currently Closed'}</span>
				</div>
			{/if}

			{#if error}
				<div class="sf-alert" data-tone="error" role="alert" style="margin-bottom:16px;">
					<span>{error}</span>
				</div>
			{/if}

			<!-- Order summary first: a customer should see what they are paying
			     for before being asked for anything. -->
			<div class="sf-panel">
				<div class="sf-section-head" style="padding:0;margin-bottom:4px;">
					<h2 style="font-size:0.9375rem;">Order summary</h2>
					<a href="/cart">Edit</a>
				</div>
				{#each cart.lines as line (line.key)}
					<div class="sf-total-row" style="padding:7px 0;">
						<span style="min-width:0;">
							{line.quantity} × {line.name}
							{#if line.addons.length}
								<span style="display:block;font-size:0.75rem;color:var(--sf-text-3);">
									{line.addons.map((a) => a.name).join(', ')}
								</span>
							{/if}
						</span>
						<span>{money(lineTotal(line), currency)}</span>
					</div>
				{/each}
				<div class="sf-totals">
					{#if totals.tax > 0}
						<div class="sf-total-row"><span>Tax</span><span>{money(totals.tax, currency)}</span></div>
					{/if}
					{#if totals.packaging_fee > 0}
						<div class="sf-total-row">
							<span>Packaging</span><span>{money(totals.packaging_fee, currency)}</span>
						</div>
					{/if}
					<div class="sf-total-row" data-strong="true">
						<span>Total</span>
						<span>{money(totals.total, currency)}</span>
					</div>
				</div>
			</div>

			<h2 class="sf-group-title">Your details</h2>
			<div class="sf-panel">
				<label class="sf-field">
					<span class="sf-label">Name *</span>
					<input
						class="sf-input"
						type="text"
						bind:value={name}
						autocomplete="name"
						enterkeyhint="next"
						aria-invalid={Boolean(fieldErrors.name)}
						placeholder="Asha Rao"
					/>
					{#if fieldErrors.name}
						<span class="sf-field-error">{fieldErrors.name}</span>
					{/if}
				</label>

				<label class="sf-field">
					<span class="sf-label">Phone *</span>
					<input
						class="sf-input"
						type="tel"
						inputmode="tel"
						bind:value={phone}
						autocomplete="tel"
						enterkeyhint="next"
						aria-invalid={Boolean(fieldErrors.phone)}
						placeholder="98765 43210"
					/>
					<span class="sf-label" style="margin-top:4px;font-weight:500;">
						We use this to tell you when your order is ready.
					</span>
					{#if fieldErrors.phone}
						<span class="sf-field-error">{fieldErrors.phone}</span>
					{/if}
				</label>

				<label class="sf-field" style="margin-bottom:0;">
					<span class="sf-label">Email <span class="sf-optional">(optional)</span></span>
					<input
						class="sf-input"
						type="email"
						inputmode="email"
						bind:value={email}
						autocomplete="email"
						enterkeyhint="next"
						aria-invalid={Boolean(fieldErrors.email)}
						placeholder="you@example.com"
					/>
					{#if fieldErrors.email}
						<span class="sf-field-error">{fieldErrors.email}</span>
					{/if}
				</label>
			</div>

			<h2 class="sf-group-title">How you collect</h2>
			<div class="sf-panel">
				<div class="sf-choice" data-selected="true" role="group">
					<span class="sf-choice-mark" aria-hidden="true"></span>
					<span class="sf-choice-body">
						<span class="sf-choice-title">Pickup</span>
						<span class="sf-choice-hint">
							Ready in about {config?.ordering.prep_time_minutes ?? 20} min ·{' '}
							{config?.store?.address || 'Collect from the counter'}
						</span>
					</span>
				</div>
			</div>

			{#if methods.length > 0}
				<h2 class="sf-group-title">How you pay</h2>
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
								<span class="sf-choice-title">{methodLabel[option] ?? option}</span>
								<span class="sf-choice-hint">{methodHint[option] ?? ''}</span>
							</span>
						</button>
					{/each}
				</div>
			{/if}

			<label class="sf-field" style="margin-top:18px;">
				<span class="sf-label">Note for the kitchen <span class="sf-optional">(optional)</span></span>
				<textarea class="sf-textarea" bind:value={notes} maxlength="140" placeholder="Anything else?"></textarea>
			</label>

			{#if !signedIn && (config?.ordering?.customer_login_mode ?? 'optional') === 'optional'}
				<div class="sf-panel" style="margin-top:18px;background:var(--sf-surface-2);">
					<p style="margin:0 0 4px;font-size:0.875rem;font-weight:650;color:var(--sf-text);">
						Save your details for next time
					</p>
					<p style="margin:0;font-size:0.8125rem;color:var(--sf-text-2);line-height:1.45;">
						Sign in with your phone to get faster checkout and order history.
					</p>
					<div class="sf-btn-row" style="margin-top:12px;">
						<a
							class="sf-btn sf-btn-secondary"
							href={'/login?phone=' + encodeURIComponent(formatPhone(phone)) + '&next=' + encodeURIComponent('/checkout')}
						>
							Sign in
						</a>
					</div>
				</div>
			{/if}

			<button
				class="sf-btn sf-btn-primary sf-btn-lg sf-btn-block"
				type="submit"
				style="margin-top:18px;"
				disabled={placing || !orderable}
			>
				{#if placing}
					Placing your order…
				{:else if method === 'ONLINE' && config?.ordering.payment_requirement === 'BEFORE_PREPARATION'}
					Pay {money(totals.total, currency)}
				{:else}
					Place order · {money(totals.total, currency)}
				{/if}
			</button>

			<p
				style="display:flex;align-items:center;justify-content:center;gap:5px;margin:12px 0 0;font-size:0.75rem;color:var(--sf-text-3);text-align:center;line-height:1.4;"
			>
				<Lock size={13} strokeWidth={1.9} aria-hidden="true" />
				Your details are used only for this order.
			</p>
		</form>
	{/if}
</div>
