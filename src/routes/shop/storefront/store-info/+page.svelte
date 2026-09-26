<script lang="ts">
	import FormField from '$lib/components/admin/FormField.svelte';
	import TextArea from '$lib/components/admin/TextArea.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { seed, type StorefrontContext } from '$lib/storefront/admin-context';
	import { storefrontAdminApi, type AdminStorefront } from '$lib/storefront/admin';
	import { toast } from '$lib/components/admin/toast';

	/**
	 * Store information: the address customers are told to collect from, the
	 * number they can call, and the two switches that decide whether the shop is
	 * open for business.
	 */
	let { config, save }: StorefrontContext = $props();

	let address = $state(seed(() => config.store.address));
	let phone = $state(seed(() => config.store.phone));
	let orderingEnabled = $state(seed(() => config.behaviour.ordering_enabled));
	let closedMessage = $state(seed(() => config.behaviour.closed_message));
	let prepTime = $state(seed(() => String(config.behaviour.prep_time_minutes)));
	let taxPercent = $state(seed(() => String(config.behaviour.tax_percent)));
	let packagingFee = $state(seed(() => String(config.behaviour.packaging_fee)));
	let saving = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const prep = Number(prepTime);
		if (!Number.isFinite(prep) || prep < 0 || prep > 240) {
			toast.error('Preparation time must be between 0 and 240 minutes');
			return;
		}
		const tax = Number(taxPercent);
		if (!Number.isFinite(tax) || tax < 0 || tax > 100) {
			toast.error('Tax must be a percentage between 0 and 100');
			return;
		}
		const fee = Number(packagingFee);
		if (!Number.isFinite(fee) || fee < 0) {
			toast.error('Packaging fee cannot be negative');
			return;
		}
		saving = true;
		const ok = await save(() =>
			storefrontAdminApi.saveBehaviour({
				ordering_enabled: orderingEnabled,
				closed_message: closedMessage.trim(),
				prep_time_minutes: Math.round(prep),
				tax_percent: tax,
				packaging_fee: fee
			})
		);
		const identityOk = ok
			? await save(() =>
					storefrontAdminApi.saveIdentity({ address: address.trim(), phone: phone.trim() })
				)
			: false;
		saving = false;
		if (ok && identityOk) toast.success('Store information saved');
		else toast.error('Could not save your store information');
	}
</script>

<form onsubmit={submit}>
	<div class="sfctl-section">
		<h2>Where customers collect</h2>
		<p class="sfctl-note">
			Shown on the confirmation screen and the tracking page, so a customer always knows where
			to go. Delivery is not part of this build.
		</p>
		<div class="sfctl-grid">
			<FormField label="Pickup address" hint="Where the counter is, and anything a customer should know.">
				<TextArea bind:value={address} rows={2} placeholder="12 MG Road, Indiranagar, Bengaluru" />
			</FormField>
			<FormField label="Phone number" hint="Customers can tap to call. Optional but useful.">
				<TextInput bind:value={phone} inputmode="tel" placeholder="98765 43210" />
			</FormField>
		</div>
	</div>

	<div class="sfctl-section">
		<h2>Ordering</h2>
		<p class="sfctl-note">
			Turning ordering off hides the cart and the checkout immediately. Customers can still
			browse your menu, and any order already placed carries on as normal.
		</p>
		<div style="display:grid;gap:0.4rem;">
			<button
				class="sfopt"
				type="button"
				aria-pressed={orderingEnabled}
				onclick={() => (orderingEnabled = !orderingEnabled)}
			>
				<span class="sfopt-mark" aria-hidden="true"></span>
				<span class="sfopt-body">
					<span class="sfopt-label">Accepting orders</span>
					<span class="sfopt-hint">
						{orderingEnabled
							? 'Customers can add to a cart and check out.'
							: 'Ordering is off. Browsing stays available.'}
					</span>
				</span>
			</button>
		</div>

		{#if !orderingEnabled}
			<div style="margin-top:0.85rem;">
				<FormField
					label="Message shown while closed"
					hint="Leave empty to show simply “Currently Closed”."
				>
					<TextInput
						bind:value={closedMessage}
						maxlength={200}
						placeholder="Back tomorrow at 9am — see you then!"
					/>
				</FormField>
			</div>
		{/if}
	</div>

	<div class="sfctl-section">
		<h2>Pricing</h2>
		<p class="sfctl-note">
			These are applied by the server when an order is placed. A customer's cart always shows the
			same figures the shop is charged, because the storefront never does this arithmetic itself.
		</p>
		<div class="sfctl-grid" data-cols="3">
			<FormField label="Preparation time" hint="Minutes, shown as an estimate on the confirmation.">
				<TextInput bind:value={prepTime} inputmode="numeric" suffix="min" />
			</FormField>
			<FormField label="Tax" hint="Percentage. Use 0 for none.">
				<TextInput bind:value={taxPercent} inputmode="decimal" suffix="%" />
			</FormField>
			<FormField label="Packaging fee" hint="Flat amount added per order. Use 0 for none.">
				<TextInput bind:value={packagingFee} inputmode="decimal" />
			</FormField>
		</div>
		<p class="field-hint" style="margin-top:0.5rem;">
			Amounts use your store currency ({config.store.currency}).
		</p>
	</div>

	<div class="sfctl-foot">
		<span class="sfctl-foot-note">Currently {config.ordering_available_now ? 'accepting orders' : 'closed'}.</span>
		<button class="btn btn-primary" type="submit" disabled={saving}>
			{saving ? 'Saving…' : 'Save store information'}
		</button>
	</div>
</form>
