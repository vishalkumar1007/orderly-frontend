<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import type { CartLine } from '$lib/storefront/cart.svelte';
	import { cartCount, estimateTotals } from '$lib/storefront/cart.svelte';
	import type { CartTotals, StoreConfig } from '$lib/storefront/api';
	import { money } from '$lib/storefront/format';

	/**
	 * The sticky cart bar.
	 *
	 * On a phone this is the primary call to action: one button, always visible,
	 * showing what is in the cart and what it costs, so a customer never has to
	 * hunt for the cart. It is hidden wherever a full-width action already
	 * exists — checkout, payment, the confirmation screen — so there is never one
	 * competing with another.
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
	<div class="sf-cartbar">
		<div class="sf-cartbar-inner">
			<a class="sf-cartbar-btn" href="/cart">
				<span class="sf-cartbar-count">
					{count} {count === 1 ? 'item' : 'items'} · {money(shown.subtotal, currency)}
				</span>
				<span class="sf-cartbar-cta">
					View cart
					<ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" />
				</span>
			</a>
		</div>
	</div>
{/if}
