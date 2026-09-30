<script lang="ts">
	import { goto } from '$app/navigation';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import { useCart } from '$lib/storefront/cart-state.svelte';
	import { normaliseAddons, unitTotal } from '$lib/storefront/cart.svelte';
	import { money } from '$lib/storefront/format';
	import type { StoreOptionGroup, StoreProduct } from '$lib/storefront/api';

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

	const optionGroups = $derived.by((): StoreOptionGroup[] => {
		if (!product) return [];
		if (product.option_groups && product.option_groups.length > 0) {
			return product.option_groups.filter((g) => g.is_active !== false && g.options?.length);
		}
		if (product.addons?.length) {
			return [
				{
					id: 'addons',
					name: 'Add-ons',
					selection: 'multiple',
					required: false,
					is_active: true,
					sort_order: 0,
					options: product.addons
				}
			];
		}
		return [];
	});

	const flatAddons = $derived(product?.addons ?? []);
	const hasOptions = $derived(optionGroups.length > 0);
	const allowsNotes = $derived(product?.allow_special_instructions ?? false);

	const picks = $derived(
		Object.entries(chosen)
			.filter(([, qty]) => qty > 0)
			.map(([id, qty]) => ({ id, quantity: qty }))
	);
	const resolvedAddons = $derived(normaliseAddons(flatAddons, picks));

	const requiredSatisfied = $derived(
		optionGroups.every((g) => {
			if (!g.required) return true;
			return g.options.some((o) => (chosen[o.id] ?? 0) > 0);
		})
	);

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

	function selectSingle(group: StoreOptionGroup, optionId: string) {
		const next = { ...chosen };
		for (const o of group.options) {
			next[o.id] = o.id === optionId ? 1 : 0;
		}
		chosen = next;
	}

	function toggleMulti(id: string, max: number) {
		chosen = { ...chosen, [id]: chosen[id] ? 0 : Math.min(1, max) };
	}

	function stepAddon(id: string, delta: number, max: number) {
		const next = Math.max(0, Math.min(max, (chosen[id] ?? 0) + delta));
		chosen = { ...chosen, [id]: next };
	}

	function addToCart() {
		if (!product || !requiredSatisfied) return;
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
		style="display:inline-flex;align-items:center;gap:4px;margin-left:var(--sf-gutter);padding:10px 0;font-size:var(--fs-body);font-weight:600;color:var(--sf-text-2);text-decoration:none;"
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
			{#each optionGroups as group (group.id)}
				<h2 class="sf-group-title">
					{group.name}
					{#if group.required}
						<span style="color:var(--sf-danger, #c44);font-weight:500;"> *</span>
					{:else}
						<span class="sf-optional" style="font-weight:500;"> (optional)</span>
					{/if}
				</h2>
				<div style="display:grid;gap:8px;">
					{#each group.options as opt (opt.id)}
						{@const qty = chosen[opt.id] ?? 0}
						{@const maxQty = opt.max_qty || 1}
						{#if group.selection === 'single'}
							<label class="sf-check" style="cursor:pointer;">
								<input
									type="radio"
									name={`group-${group.id}`}
									checked={qty > 0}
									disabled={!product.is_available || !orderable}
									onchange={() => selectSingle(group, opt.id)}
									style="accent-color:var(--sf-accent);"
								/>
								<span class="sf-check-body" style="flex:1;">
									<span class="sf-check-name">{opt.name}</span>
									<span class="sf-check-price" style="font-weight:500;color:var(--sf-text-2);">
										{opt.price > 0 ? `+${money(opt.price, currency)}` : 'Included'}
									</span>
								</span>
							</label>
						{:else}
							<div class="sf-check" style="cursor:default;">
								<button
									class="sf-check-box"
									type="button"
									aria-pressed={qty > 0}
									aria-label={(qty > 0 ? 'Remove ' : 'Add ') + opt.name}
									disabled={!product.is_available || !orderable}
									onclick={() => toggleMulti(opt.id, maxQty)}
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
									onclick={() => toggleMulti(opt.id, maxQty)}
								>
									<span class="sf-check-name">{opt.name}</span>
									<span class="sf-check-price" style="font-weight:500;color:var(--sf-text-2);">
										+{money(opt.price, currency)}
									</span>
								</button>
								{#if qty > 0 && maxQty > 1}
									<span class="sf-stepper" style="height:34px;">
										<button
											type="button"
											style="width:32px;height:32px;"
											aria-label={'Fewer ' + opt.name}
											onclick={() => stepAddon(opt.id, -1, maxQty)}
										>
											<Minus size={13} strokeWidth={2.6} aria-hidden="true" />
										</button>
										<output style="min-width:22px;font-size:var(--fs-body);">{qty}</output>
										<button
											type="button"
											style="width:32px;height:32px;"
											aria-label={'More ' + opt.name}
											disabled={qty >= maxQty}
											onclick={() => stepAddon(opt.id, 1, maxQty)}
										>
											<Plus size={13} strokeWidth={2.6} aria-hidden="true" />
										</button>
									</span>
								{/if}
							</div>
						{/if}
					{/each}
				</div>
			{/each}
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
					placeholder="Any special requests…"
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
			disabled={!product.is_available || !orderable || !requiredSatisfied}
			onclick={addToCart}
		>
			{#if justAdded}
				Added
			{:else if hasOptions && !requiredSatisfied}
				Choose options
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
