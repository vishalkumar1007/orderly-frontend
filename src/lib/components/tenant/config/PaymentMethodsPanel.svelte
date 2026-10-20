<script lang="ts">
	/**
	 * How customers pay: which methods appear at checkout, which one is
	 * preselected, and whether cash buyers are told to pay at the counter.
	 * Edits collect in a draft and save together from the save bar.
	 */
	import CreditCard from '@tabler/icons-svelte/icons/credit-card';
	import Cash from '@tabler/icons-svelte/icons/cash';
	import { storefrontAdminApi } from '$lib/storefront/admin';
	import { useStorefront, type StorefrontContext } from '$lib/storefront/admin-context';
	import { toast } from '$lib/components/admin/toast';
	import PaymentModeBanner from '$lib/components/shop/PaymentModeBanner.svelte';
	import ConfigCard from '$lib/components/config/ConfigCard.svelte';
	import ConfigRow from '$lib/components/config/ConfigRow.svelte';
	import SaveBar from '$lib/components/config/SaveBar.svelte';
	import Toggle from '$lib/components/config/Toggle.svelte';
	import Segmented from '$lib/components/config/Segmented.svelte';

	let props: Partial<StorefrontContext> = $props();
	const ctx = useStorefront(() => props);

	type Draft = { online: boolean; cash: boolean; atPickup: boolean; preferred: string };
	const fromConfig = (): Draft => {
		const p = ctx.config.payments;
		return {
			online: !!p?.online_payment_enabled,
			cash: !!p?.cash_enabled,
			atPickup: !!p?.pay_at_pickup_enabled,
			preferred: p?.default_payment_method ?? 'ONLINE'
		};
	};

	let draft = $state<Draft>(fromConfig());
	let saving = $state(false);
	const saved = $derived(fromConfig());
	const dirty = $derived(JSON.stringify(draft) !== JSON.stringify(saved));
	const noneOn = $derived(!draft.online && !draft.cash);

	// The preselected method has to be one the customer can actually pick.
	const effectiveDefault = $derived(
		draft.online ? (draft.preferred === 'CASH' && draft.cash ? 'CASH' : 'ONLINE') : 'CASH'
	);

	async function save() {
		if (noneOn) {
			toast.error('Keep at least one payment method switched on');
			return;
		}
		saving = true;
		const ok = await ctx.save(() =>
			storefrontAdminApi.savePayments({
				online_payment_enabled: draft.online,
				cash_enabled: draft.cash,
				pay_at_pickup_enabled: draft.atPickup,
				default_payment_method: effectiveDefault
			})
		);
		saving = false;
		if (ok) {
			draft = fromConfig();
			toast.success('Payment settings saved');
		} else {
			toast.error('Could not save your payment settings');
		}
	}
</script>

<div class="pm">
	<PaymentModeBanner />

	<ConfigCard
		id="pm-methods"
		title="Payment methods"
		description="What customers can choose at checkout. Turning one off hides it; orders already placed are not affected."
		flush
	>
		<ConfigRow
			icon={CreditCard}
			label="Online payment"
			description="UPI, cards and net banking through your payment provider."
			forId="pm-online"
		>
			<Toggle id="pm-online" label="Online payment" bind:checked={draft.online} />
		</ConfigRow>
		<ConfigRow icon={Cash} label="Cash" description="The customer pays you in person." forId="pm-cash">
			<Toggle id="pm-cash" label="Cash" bind:checked={draft.cash} />
		</ConfigRow>
		{#if noneOn}
			<p class="pm-warn" role="alert">Switch at least one method on, or customers cannot pay for an order.</p>
		{/if}
	</ConfigCard>

	<ConfigCard id="pm-checkout" title="Checkout" description="How the payment step behaves for customers." flush>
		<ConfigRow label="Preselected method" description="Saves the common case a tap. Customers can still switch.">
			<Segmented
				label="Preselected method"
				value={effectiveDefault}
				options={[
					{ value: 'ONLINE', label: 'Online', disabled: !draft.online },
					{ value: 'CASH', label: 'Cash', disabled: !draft.cash }
				]}
				onchange={(v) => (draft.preferred = v)}
			/>
		</ConfigRow>
		<ConfigRow
			label="Ask cash customers to pay at the counter"
			description={draft.atPickup
				? 'The confirmation shows "pay at pickup" with the amount, and the order waits until you mark it paid.'
				: 'The confirmation shows the amount without payment instructions.'}
			forId="pm-pickup"
		>
			<Toggle id="pm-pickup" label="Pay at the counter" bind:checked={draft.atPickup} disabled={!draft.cash} />
		</ConfigRow>
	</ConfigCard>

	<SaveBar
		{dirty}
		{saving}
		disabled={noneOn}
		message={noneOn ? 'Switch on at least one payment method' : 'You have unsaved changes'}
		ondiscard={() => (draft = fromConfig())}
		onsave={save}
	/>
</div>

<style>
	.pm {
		display: flex;
		flex-direction: column;
		gap: var(--sp-9);
	}

	.pm-warn {
		margin: 0;
		padding: var(--sp-6) var(--sp-10);
		border-top: 1px solid var(--border-subtle);
		background: var(--warn-bg);
		color: var(--warn);
		font-size: var(--fs-tab);
	}




</style>
