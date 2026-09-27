<script lang="ts">
	import { PAYMENT_METHODS, storefrontAdminApi, type AdminStorefront } from '$lib/storefront/admin';
	import { seed, useStorefront, type StorefrontContext } from '$lib/storefront/admin-context';
	import { toast } from '$lib/components/admin/toast';

	let props: Partial<StorefrontContext> = $props();
	const ctx = useStorefront(() => props);
	const config = $derived(ctx.config);
	const save = (run: Parameters<StorefrontContext['save']>[0]) => ctx.save(run);

	let online = $state(seed(() => ctx.config.payments.online_payment_enabled));
	let cash = $state(seed(() => ctx.config.payments.cash_enabled));
	let atPickup = $state(seed(() => ctx.config.payments.pay_at_pickup_enabled));
	let preferred = $state(seed(() => ctx.config.payments.default_payment_method));
	let saving = $state(false);

	let dirty = false;
	$effect(() => {
		const p = ctx.config.payments;
		if (!dirty && p) {
			online = p.online_payment_enabled;
			cash = p.cash_enabled;
			atPickup = p.pay_at_pickup_enabled;
			preferred = p.default_payment_method;
		}
	});

	/** `offered` is what the storefront will actually show. */
	const offered = $derived([online ? 'ONLINE' : '', cash ? 'CASH' : ''].filter(Boolean));

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!online && !cash) {
			toast.error('Keep at least one payment method switched on');
			return;
		}
		// The default has to be one the customer can actually choose.
		const nextDefault = online
			? preferred === 'CASH' && cash
				? 'CASH'
				: 'ONLINE'
			: 'CASH';
		saving = true;
		const ok = await save(() =>
			storefrontAdminApi.savePayments({
				online_payment_enabled: online,
				cash_enabled: cash,
				pay_at_pickup_enabled: atPickup,
				default_payment_method: nextDefault
			})
		);
		saving = false;
		if (ok) toast.success('Payment settings saved');
		else toast.error('Could not save your payment settings');
	}
</script>

<form onsubmit={submit}>
	<div class="sfctl-section">
		<h2>How customers can pay</h2>
		<p class="sfctl-note">
			Customers only ever see the methods you switch on here. Turning one off hides it at
			checkout; it does not affect any order already placed.
		</p>

		<div style="display:grid;gap:0.4rem;">
			{#each PAYMENT_METHODS as method (method.value)}
				<button
					class="sfopt"
					type="button"
					aria-pressed={method.value === 'ONLINE' ? online : cash}
					onclick={() => (method.value === 'ONLINE' ? (online = !online) : (cash = !cash))}
				>
					<span class="sfopt-mark" aria-hidden="true"></span>
					<span class="sfopt-body">
						<span class="sfopt-label">{method.label}</span>
						<span class="sfopt-hint">{method.hint}</span>
					</span>
				</button>
			{/each}
		</div>

		{#if !online && !cash}
			<div class="alert alert-warn" style="margin-top:0.9rem;">
				At least one method must stay on, or customers cannot pay for an order. The server
				refuses this combination.
			</div>
		{/if}
	</div>

	<div class="sfctl-section">
		<h2>Pay at pickup</h2>
		<p class="sfctl-note">
			When on, a customer choosing cash is told plainly that they pay at the counter, and the
			order waits for you to mark the payment received.
		</p>
		<div style="display:grid;gap:0.4rem;">
			<button
				class="sfopt"
				type="button"
				aria-pressed={atPickup}
				onclick={() => (atPickup = !atPickup)}
			>
				<span class="sfopt-mark" aria-hidden="true"></span>
				<span class="sfopt-body">
					<span class="sfopt-label">Tell customers to pay at the counter</span>
					<span class="sfopt-hint">
						{atPickup
							? 'The confirmation screen shows “pay at pickup” and the amount.'
							: 'The confirmation screen shows the amount without payment instructions.'}
					</span>
				</span>
			</button>
		</div>
	</div>

	<div class="sfctl-section">
		<h2>Default method</h2>
		<p class="sfctl-note">
			Preselected at checkout so the common case is one tap. Customers can change it if you offer
			more than one.
		</p>
		<div style="display:grid;gap:0.4rem;">
			{#each PAYMENT_METHODS.filter((m) => (m.value === 'ONLINE' ? online : cash)) as method (method.value)}
				<button
					class="sfopt"
					type="button"
					aria-pressed={preferred === method.value}
					onclick={() => (preferred = method.value)}
				>
					<span class="sfopt-mark" aria-hidden="true"></span>
					<span class="sfopt-body"><span class="sfopt-label">{method.label}</span></span>
				</button>
			{/each}
		</div>
	</div>

	<div class="sfctl-foot">
		<span class="sfctl-foot-note">
			Customers will see: {offered.length ? offered.join(' and ').replace('ONLINE', 'online').replace('CASH', 'cash') : 'nothing — fix the switches above'}
		</span>
		<button class="btn btn-primary" type="submit" disabled={saving}>
			{saving ? 'Saving…' : 'Save payment settings'}
		</button>
	</div>
</form>
