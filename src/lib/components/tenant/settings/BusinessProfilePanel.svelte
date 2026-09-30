<script lang="ts">
	import FormField from '$lib/components/admin/FormField.svelte';
	import TextArea from '$lib/components/admin/TextArea.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { storefrontAdminApi } from '$lib/storefront/admin';
	import { seed, useStorefront, type StorefrontContext } from '$lib/storefront/admin-context';
	import { toast } from '$lib/components/admin/toast';

	/**
	 * Business profile — organization contact only.
	 *
	 * Pickup address and phone customers see on confirmation. Ordering pause,
	 * store status, and bill pricing live under Storefront → Launch.
	 */
	let props: Partial<StorefrontContext> = $props();
	const ctx = useStorefront(() => props);
	const save = (run: Parameters<StorefrontContext['save']>[0]) => ctx.save(run);

	let address = $state(seed(() => ctx.config.store.address));
	let phone = $state(seed(() => ctx.config.store.phone));
	let saving = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		saving = true;
		const ok = await save(() =>
			storefrontAdminApi.saveIdentity({ address: address.trim(), phone: phone.trim() })
		);
		saving = false;
		if (ok) toast.success('Business profile saved');
		else toast.error('Could not save your business profile');
	}
</script>

<form onsubmit={submit}>
	<div class="sfctl-section">
		<h2>Where customers collect</h2>
		<p class="sfctl-note">
			Shown on the confirmation screen and the tracking page, so a customer always knows where to
			go. Delivery is not part of this build.
		</p>
		<div class="sfctl-grid">
			<FormField
				label="Pickup address"
				hint="Where the counter is, and anything a customer should know."
			>
				<TextArea bind:value={address} rows={2} placeholder="12 MG Road, Indiranagar, Bengaluru" />
			</FormField>
			<FormField label="Phone number" hint="Customers can tap to call. Optional but useful.">
				<TextInput bind:value={phone} inputmode="tel" placeholder="98765 43210" />
			</FormField>
		</div>
	</div>

	<div class="sfctl-foot">
		<span class="sfctl-foot-note">
			Ordering, status, and pricing are under Storefront → Launch.
		</span>
		<button class="btn btn-primary" type="submit" disabled={saving}>
			{saving ? 'Saving…' : 'Save business profile'}
		</button>
	</div>
</form>
