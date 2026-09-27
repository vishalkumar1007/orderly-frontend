<script lang="ts">
	import FormField from '$lib/components/admin/FormField.svelte';
	import TextArea from '$lib/components/admin/TextArea.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import { loadStorefrontAdmin, type AdminStorefront } from '$lib/storefront/adminCache.svelte';
	import { storefrontAdminApi } from '$lib/storefront/admin';
	import { toast } from '$lib/components/admin/toast';

	let config = $state<AdminStorefront | null>(null);
	let loading = $state(true);
	let error = $state('');
	let saving = $state(false);

	// Form fields
	let address = $state('');
	let phone = $state('');
	let orderingEnabled = $state(false);
	let closedMessage = $state('');
	let prepTime = $state('');
	let taxPercent = $state('');
	let packagingFee = $state('');
	let loaded = $state(false);

	async function load() {
		loading = true;
		error = '';
		try {
			const cfg = await loadStorefrontAdmin();
			config = cfg;
			if (!loaded) {
				address = cfg.store.address;
				phone = cfg.store.phone;
				orderingEnabled = cfg.behaviour.ordering_enabled;
				closedMessage = cfg.behaviour.closed_message;
				prepTime = String(cfg.behaviour.prep_time_minutes);
				taxPercent = String(cfg.behaviour.tax_percent);
				packagingFee = String(cfg.behaviour.packaging_fee);
				loaded = true;
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not load your storefront';
		} finally {
			loading = false;
		}
	}

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
		try {
			await storefrontAdminApi.saveBehaviour({
				ordering_enabled: orderingEnabled,
				closed_message: closedMessage.trim(),
				prep_time_minutes: Math.round(prep),
				tax_percent: tax,
				packaging_fee: fee
			});
			await storefrontAdminApi.saveIdentity({ address: address.trim(), phone: phone.trim() });
			toast.success('Store information saved');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not save your store information');
		} finally {
			saving = false;
		}
	}

	load();
</script>

{#if loading}
	<div class="panel">
		<Skeleton height="1.2rem" width="12rem" />
		<div style="margin-top:1rem;display:grid;gap:0.7rem;grid-template-columns:repeat(auto-fill,minmax(11rem,1fr));">
			{#each [1, 2, 3, 4, 5, 6] as i (i)}
				<Skeleton height="4.5rem" />
			{/each}
		</div>
	</div>
{:else if error && !config}
	<ErrorState message={error} onretry={load} />
{:else if config}
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
						hint={'Leave empty to show simply "Currently Closed".'}
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
{/if}
