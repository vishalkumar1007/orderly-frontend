<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import { useCart } from '$lib/storefront/cart-state.svelte';
	import { normaliseAddons, unitTotal, type CartLine } from '$lib/storefront/cart.svelte';
	import { money } from '$lib/storefront/format';
	import type { StoreProduct } from '$lib/storefront/api';

	/**
	 * Product detail.
	 *
	 * This is the only screen where a customer chooses options, so it carries the
	 * quantity stepper, the add-on list and the special-instruction field. The
	 * sticky bar always shows the running total, because a customer changing four
	 * add-ons needs to see what it costs without scrolling back up.
	 */
	let { data } = $props();

	const cart = useCart();
	const product = $derived(data.product as StoreProduct | null);
	const config = $derived(data.config);
	const currency = $derived(config?.store?.currency ?? 'INR');
	const orderable = $derived(config?.ordering.enabled ?? false);

	let quantity = $state(1);
	let chosen = $state<Record<string, number>>({});
	let notes = $state('');
	let justAdded = $state(false);

	const addons = $derived(product?.addons ?? []);
	const hasOptions = $derived(addons.length > 0);
	const allowsNotes = $derived(product?.allow_special_instructions ?? false);

	/**
	 * `picks` is what the customer chose, as ids and counts. `resolvedAddons` is
	 * that resolved against the product's catalogue, so the name and price shown
	 * always come from the product rather than from anything the page holds.
	 */
	const picks = $derived(
		Object.entries(chosen)
			.filter(([, qty]) => qty > 0)
			.map(([id, qty]) => ({ id, quantity: qty }))
	);
	const resolvedAddons = $derived(normaliseAddons(addons, picks));

	/** The unit total is the product price plus its chosen extras. */
	const unit = $derived(
		unitTotal({
			key: '',
			product_id: product?.id ?? '',
			name: product?.name ?? '',
			price: product?.price ?? 0,
			quantity: 1,
			addons: resolvedAddons,
			notes: '',
			available: true,
			needs_options: false
		})
	);
	const lineTotal = $derived(unit * quantity);

	const inCart = $derived(cart.quantityOf(product?.id ?? ''));

	function toggleAddon(id: string, max: number) {
		chosen = { ...chosen, [id]: chosen[id] ? 0 : Math.min(1, max) };
	}

	function stepAddon(id: string, delta: number, max: number) {
		const next = Math.max(0, Math.min(max, (chosen[id] ?? 0) + delta));
		chosen = { ...chosen, [id]: next };
	}

	function addToCart() {
		if (!product) return;
		const result = cart.add(product, quantity, resolvedAddons, notes);
		if (result.ok) {
			justAdded = true;
			quantity = 1;
			chosen = {};
			notes = '';
			setTimeout(() => (justAdded = false), 2400);
		}
	}
</script>

<div style="padding-bottom:8px;">
	<a
		href="/menu"
		style="display:inline-flex;align-items:center;gap:4px;margin-left:var(--sf-gutter);padding:10px 0;font-size:0.8125rem;font-weight:600;color:var(--sf-text-2);text-decoration:none;"
	>
		<ChevronLeft size={16} strokeWidth={2.2} aria-hidden="true" />
		Menu
	</a>
</div>

{#if product}
	<div class="sf-detail-media">
		{#if product.image_url}
			<img
				src={product.image_url}
				alt={product.name}
				width="800"
				height="500"
				fetchpriority="high"
				decoding="async"
			/>
		{/if}
	</div>

	<div class="sf-detail-body">
		<h1 class="sf-detail-title">
			{product.name}
			{#if product.is_vegetarian}
				<span class="sf-veg-mark" style="vertical-align:middle;" title="Vegetarian" aria-label="Vegetarian">
					<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" aria-hidden="true">
						<path d="M20 6 9 17l-5-5" />
					</svg>
				</span>
			{/if}
		</h1>
		<p class="sf-detail-price">{money(product.price, currency)}</p>
		{#if product.description}
			<p class="sf-detail-desc">{product.description}</p>
		{/if}

		{#if !product.is_available}
			<div class="sf-alert" data-tone="error" style="margin-top:16px;" role="status">
				<span>This item is sold out right now.</span>
			</div>
		{:else if !orderable}
			<div class="sf-alert" data-tone="warn" style="margin-top:16px;" role="status">
				<span>{config?.ordering.closed_reason || 'Currently Closed'}</span>
			</div>
		{/if}

		{#if hasOptions}
			<h2 class="sf-group-title">Add extras</h2>
			<div style="display:grid;gap:8px;">
				{#each addons as addon (addon.id)}
					{@const qty = chosen[addon.id] ?? 0}
					<!--
						A row, not a nested button: the toggle and the quantity stepper
						are separate controls, and buttons cannot legally contain
						buttons. Both are siblings inside one row.
					-->
					<div class="sf-check" style="cursor:default;">
						<button
							class="sf-check-box"
							type="button"
							aria-pressed={qty > 0}
							aria-label={(qty > 0 ? 'Remove ' : 'Add ') + addon.name}
							disabled={!product.is_available || !orderable}
							onclick={() => toggleAddon(addon.id, addon.max_qty)}
							style="border:none;cursor:pointer;padding:0;"
						>
							<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" aria-hidden="true">
								<path d="M20 6 9 17l-5-5" />
							</svg>
						</button>
						<button
							type="button"
							class="sf-check-body"
							style="border:none;background:transparent;font:inherit;color:inherit;text-align:left;cursor:pointer;padding:0;"
							disabled={!product.is_available || !orderable}
							onclick={() => toggleAddon(addon.id, addon.max_qty)}
						>
							<span class="sf-check-name">{addon.name}</span>
							<span class="sf-check-price" style="font-weight:500;color:var(--sf-text-2);">
								+{money(addon.price, currency)}
							</span>
						</button>
						{#if qty > 0 && addon.max_qty > 1}
							<span class="sf-stepper" style="height:34px;">
								<button
									type="button"
									style="width:32px;height:32px;"
									aria-label={'Fewer ' + addon.name}
									onclick={() => stepAddon(addon.id, -1, addon.max_qty)}
								>
									<Minus size={13} strokeWidth={2.6} aria-hidden="true" />
								</button>
								<output style="min-width:22px;font-size:0.8125rem;">{qty}</output>
								<button
									type="button"
									style="width:32px;height:32px;"
									aria-label={'More ' + addon.name}
									disabled={qty >= addon.max_qty}
									onclick={() => stepAddon(addon.id, 1, addon.max_qty)}
								>
									<Plus size={13} strokeWidth={2.6} aria-hidden="true" />
								</button>
							</span>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		<h2 class="sf-group-title">Quantity</h2>
		<div class="sf-stepper">
			<button
				type="button"
				aria-label="One fewer"
				disabled={quantity <= 1}
				onclick={() => (quantity = Math.max(1, quantity - 1))}
			>
				<Minus size={16} strokeWidth={2.4} />
			</button>
			<output aria-live="polite">{quantity}</output>
			<button
				type="button"
				aria-label="One more"
				disabled={quantity >= 20}
				onclick={() => (quantity = Math.min(20, quantity + 1))}
			>
				<Plus size={16} strokeWidth={2.4} />
			</button>
		</div>

		{#if allowsNotes}
			<label class="sf-field" style="margin-top:18px;">
				<span class="sf-label">Special instructions <span class="sf-optional">(optional)</span></span>
				<textarea
					class="sf-textarea"
					bind:value={notes}
					maxlength="140"
					placeholder="Less spicy, extra chutney…"
				></textarea>
			</label>
		{/if}
	</div>

	<div class="sf-detail-bar">
		<div class="sf-detail-bar-total">
			<strong>{money(lineTotal, currency)}</strong>
			<span>
				{#if resolvedAddons.length}
					{money(unit, currency)} each · {resolvedAddons.length} extra{resolvedAddons.length === 1 ? '' : 's'}
				{:else}
					{quantity} × {money(product.price, currency)}
				{/if}
			</span>
		</div>
		<button
			class="sf-btn sf-btn-primary sf-btn-lg"
			type="button"
			style="min-width:150px;"
			disabled={!product.is_available || !orderable}
			onclick={addToCart}
		>
			{#if justAdded}
				Added
			{:else}
				<ShoppingBag size={18} strokeWidth={2.1} aria-hidden="true" />
				Add to cart
			{/if}
		</button>
	</div>

	{#if inCart > 0}
		<div class="sf-wrap" style="padding-top:14px;">
			<button
				class="sf-btn sf-btn-secondary sf-btn-block"
				type="button"
				onclick={() => goto('/cart')}
			>
				{inCart} in cart · View cart
			</button>
		</div>
	{/if}
{/if}
