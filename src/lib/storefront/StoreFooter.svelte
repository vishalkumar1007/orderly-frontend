<script lang="ts">
	import type { StoreConfig, StoreHours } from '$lib/storefront/api';
	import { DayLabels } from '$lib/storefront/hours';
	import { formatPhone } from '$lib/storefront/format';
	import { experienceFor } from '$lib/storefront/experience';

	/**
	 * The footer.
	 *
	 * Carries the business information a customer actually needs at pickup:
	 * address, phone, opening hours: plus a route back to sign-in. It is a
	 * content section, not decoration: on a storefront with no dedicated contact
	 * page this is where "where am I collecting from" is answered.
	 */
	let {
		config,
		showHours = true,
		signedIn = false
	}: {
		config: StoreConfig | null;
		showHours?: boolean;
		/** Swaps the sign-in link for the account link once signed in. */
		signedIn?: boolean;
	} = $props();

	const store = $derived(config?.store ?? null);
	const hours = $derived(config?.hours ?? null);
	const currency = $derived(config?.store?.currency ?? 'INR');
	const exp = $derived(experienceFor(config));
	/** Where the customer's history lives and what this business does. */
	const links = $derived(
		exp.family === 'order'
			? [{ href: exp.paths.catalog, label: exp.words.catalog }, { href: exp.paths.history, label: 'Your orders' }]
			: [{ href: exp.family === 'book' ? '/bookings' : '/reservations', label: `Your ${exp.words.history.toLowerCase()}` }]
	);
	const note = $derived(
		exp.family === 'order'
			? `${exp.words.fulfilment} only. Prices in ${currency}.`
			: `Prices in ${currency}. ${exp.words.payAtVenue}.`
	);
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
			{hours.detail}
		</p>
	{/if}

	<nav class="sf-footer-links" aria-label="More">
		{#each links as l (l.href)}<a href={l.href}>{l.label}</a>{/each}
		{#if exp.features.signIn}<a href={signedIn ? '/profile' : '/login'}>{signedIn ? 'Your account' : 'Sign in'}</a>{/if}
	</nav>

	<p class="sf-footer-note" style="margin-top:14px;">{note}</p>
</footer>
