<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import type { CartLine } from '$lib/storefront/cart.svelte';
	import { cartCount, estimateTotals } from '$lib/storefront/cart.svelte';
	import type { CartTotals, StoreConfig } from '$lib/storefront/api';
	import { money } from '$lib/storefront/format';

	/**
	 * Professional Food Order App Floating Sticky Cart Bar.
	 *
	 * When the customer adds food items to their cart, this sleek floating
	 * bar appears at the bottom with item count, subtotal, and an animated
	 * "View Cart" CTA.
	 */
	let {
		lines,
		config,
		totals,
		visible = true
	}: {
		lines: CartLine[];
		config: StoreConfig | null;
		totals?: CartTotals | null;
		visible?: boolean;
	} = $props();

	const count = $derived(cartCount(lines));
	const currency = $derived(config?.store?.currency ?? 'INR');
	const shown = $derived(totals ?? estimateTotals(lines));
</script>

{#if visible && count > 0}
	<aside class="sf-cartbar sf-floating-cartbar" aria-label="Cart summary">
		<div class="sf-cartbar-inner">
			<a class="sf-cartbar-btn sf-food-cartbar-btn" href="/cart">
				<div class="sf-cartbar-left">
					<div class="sf-cartbar-icon-pill">
						<ShoppingBag size={18} strokeWidth={2.4} aria-hidden="true" />
						<span class="sf-cartbar-count-badge">{count}</span>
					</div>
					<div class="sf-cartbar-pricing">
						<span class="sf-cartbar-total">{money(shown.subtotal, currency)}</span>
						<span class="sf-cartbar-sublabel">
							{count} {count === 1 ? 'item' : 'items'} · Plus taxes
						</span>
					</div>
				</div>

				<div class="sf-cartbar-cta">
					<span class="sf-cartbar-cta-text">View Cart</span>
					<div class="sf-cartbar-arrow-circle" aria-hidden="true">
						<ChevronRight size={17} strokeWidth={2.6} />
					</div>
				</div>
			</a>
		</div>
	</aside>
{/if}
