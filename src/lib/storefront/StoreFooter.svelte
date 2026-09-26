<script lang="ts">
	import type { StoreConfig, StoreHours } from '$lib/storefront/api';
	import { DayLabels } from '$lib/storefront/hours';
	import { money } from '$lib/storefront/format';
	import { formatPhone } from '$lib/storefront/format';

	/**
	 * The footer.
	 *
	 * Carries the business information a customer actually needs at pickup —
	 * address, phone, opening hours — plus a route back to sign-in. It is a
	 * content section, not decoration: on a storefront with no dedicated contact
	 * page this is where "where am I collecting from" is answered.
	 */
	let {
		config,
		showHours = true
	}: {
		config: StoreConfig | null;
		showHours?: boolean;
	} = $props();

	const store = $derived(config?.store ?? null);
	const hours = $derived(config?.hours ?? null);
	const currency = $derived(config?.store?.currency ?? 'INR');
</script>

<footer class="sf-footer">
	<p class="sf-footer-name">{store?.name ?? 'Orderly'}</p>
	{#if store?.address}
		<p class="sf-footer-note">{store.address}</p>
	{/if}
	{#if store?.phone}
		<p class="sf-footer-note">
			<a href={'tel:' + store.phone.replace(/[^\d+]/g, '')} style="color:inherit;">
				{formatPhone(store.phone)}
			</a>
		</p>
	{/if}

	{#if showHours && hours && !hours.always_open}
		<p class="sf-footer-note" style="margin-top:8px;">
			{hours.is_open ? hours.detail : hours.detail}
		</p>
	{/if}

	<nav class="sf-footer-links" aria-label="More">
		<a href="/menu">Menu</a>
		<a href="/orders">Your orders</a>
		<a href="/login">Sign in</a>
	</nav>

	<p class="sf-footer-note" style="margin-top:14px;">Pickup only · Prices in {currency}</p>
</footer>
