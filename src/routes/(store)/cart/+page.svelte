<script lang="ts">
	import { onMount } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { useCart } from '$lib/storefront/cart-state.svelte';
	import { lineTotal, quoteRequest, unitTotal } from '$lib/storefront/cart.svelte';
	import { friendlyError, storefrontApi } from '$lib/storefront/api';
	import { money } from '$lib/storefront/format';

	/**
	 * The cart.
	 *
	 * Totals are asked for from the server rather than computed here. Tax and
	 * packaging come from the tenant's configuration, and the only number that
	 * matters is the one that will be charged — so the cart shows what the server
	 * said, and a failure falls back to the item subtotal with an explanation
	 * rather than a silently wrong total.
	 */
	let { data } = $props();

	const cart = useCart();
	const config = $derived(data.config);
	const currency = $derived(config?.store?.currency ?? 'INR');
	const orderable = $derived(config?.ordering.enabled ?? false);

	let quoting = $state(false);
	let quoteError = $state('');

	async function refreshQuote() {
		if (!cart.lines.length) {
			cart.setTotals(null);
			return;
		}
		quoting = true;
		quoteError = '';
		try {
			const quote = await storefrontApi.quote(quoteRequest(cart.lines));
			cart.setTotals(quote.totals);
		} catch (err) {
			// A failed quote must not block checkout: the server re-prices the
			// order anyway, so the customer can still proceed and see the real
			// figure on the confirmation screen.
			cart.setTotals(null);
			quoteError = friendlyError(err, 'Could not refresh the total');
		} finally {
			quoting = false;
		}
	}

	onMount(refreshQuote);

	const totals = $derived(cart.estimate());
	const hasExtras = $derived(
		totals.tax > 0 || totals.packaging_fee > 0 || totals.discount > 0
	);
</script>

<div class="sf-wrap" style="padding-top:16px;">
	<div class="sf-section-head" style="padding-inline:0;margin-bottom:6px;">
		<h2>Your cart</h2>
		{#if cart.lines.length > 0}
			<button
				type="button"
				class="sf-line-remove"
				style="padding:0;"
				onclick={() => {
					if (cart.lines.length === 0) return;
					cart.empty();
					cart.setTotals(null);
				}}
			>
				Clear cart
			</button>
		{/if}
	</div>

	{#if !orderable}
		<div class="sf-alert" data-tone="warn" role="status" style="margin-bottom:14px;">
			<span>{config?.ordering.closed_reason || 'Currently Closed'}</span>
		</div>
	{/if}

	{#if cart.lines.length === 0}
		<div class="sf-empty">
			<span class="sf-empty-icon" aria-hidden="true">
				<ShoppingBag size={26} strokeWidth={1.7} />
			</span>
			<h3>Your cart is empty</h3>
			<p>Add something from the menu and it will show up here.</p>
			<a class="sf-btn sf-btn-primary" href="/menu">Browse the menu</a>
		</div>
	{:else}
		<div class="sf-panel">
			{#each cart.lines as line (line.key)}
				<div class="sf-line">
					<div class="sf-line-media">
						{#if line.image_url}
							<img src={line.image_url} alt="" width="60" height="60" loading="lazy" decoding="async" />
						{/if}
					</div>
					<div class="sf-line-body">
						<div class="sf-line-head">
							<span class="sf-line-name">{line.name}</span>
							<span class="sf-line-price">{money(lineTotal(line), currency)}</span>
						</div>
						{#if line.addons.length}
							<div class="sf-line-addons">
								{#each line.addons as addon (addon.id)}
									{addon.quantity > 1 ? `${addon.quantity} × ` : ''}{addon.name} (+{money(addon.price, currency)}){line.addons.length > 1 ? ', ' : ''}
								{/each}
							</div>
						{/if}
						{#if line.notes}
							<div class="sf-line-notes">“{line.notes}”</div>
						{/if}
						<div class="sf-line-foot">
							<div class="sf-stepper">
								<button
									type="button"
									aria-label={'One fewer ' + line.name}
									onclick={() => {
										cart.step(line.key, -1);
										refreshQuote();
									}}
								>
									<Minus size={15} strokeWidth={2.4} aria-hidden="true" />
								</button>
								<output aria-live="polite">{line.quantity}</output>
								<button
									type="button"
									aria-label={'One more ' + line.name}
									disabled={line.quantity >= 20}
									onclick={() => {
										cart.step(line.key, 1);
										refreshQuote();
									}}
								>
									<Plus size={15} strokeWidth={2.4} aria-hidden="true" />
								</button>
							</div>
							<button class="sf-line-remove" type="button" onclick={() => {
								cart.remove(line.key);
								refreshQuote();
							}}>
								<Trash2 size={15} strokeWidth={1.9} aria-hidden="true" /> Remove
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<div class="sf-panel" style="margin-top:12px;">
			<div class="sf-totals">
				<div class="sf-total-row">
					<span>Subtotal</span>
					<span>{money(totals.subtotal, currency)}</span>
				</div>
				{#if totals.tax > 0}
					<div class="sf-total-row">
						<span>Tax</span>
						<span>{money(totals.tax, currency)}</span>
					</div>
				{/if}
				{#if totals.packaging_fee > 0}
					<div class="sf-total-row">
						<span>Packaging</span>
						<span>{money(totals.packaging_fee, currency)}</span>
					</div>
				{/if}
				{#if totals.discount > 0}
					<div class="sf-total-row">
						<span>Discount</span>
						<span>−{money(totals.discount, currency)}</span>
					</div>
				{/if}
				<div class="sf-total-row" data-strong="true">
					<span>Total</span>
					<span>{money(totals.total, currency)}</span>
				</div>
			</div>
			{#if quoting}
				<p style="margin:10px 0 0;font-size:0.75rem;color:var(--sf-text-3);">Updating total…</p>
			{:else if quoteError}
				<p style="margin:10px 0 0;font-size:0.75rem;color:var(--sf-warn);">
					{quoteError} The final amount is confirmed when you place the order.
				</p>
			{/if}
		</div>

		<div style="margin-top:16px;display:grid;gap:10px;">
			<a class="sf-btn sf-btn-primary sf-btn-lg sf-btn-block" href="/checkout">
				Checkout · {money(totals.total, currency)}
			</a>
			<a class="sf-btn sf-btn-secondary sf-btn-block" href="/menu">
				<ArrowLeft size={17} strokeWidth={2} aria-hidden="true" />
				Continue shopping
			</a>
		</div>
	{/if}
</div>
