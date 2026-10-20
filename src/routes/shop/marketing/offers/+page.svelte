<script lang="ts">
	import { onMount } from 'svelte';
	import Ticket from '@tabler/icons-svelte/icons/ticket';
	import Gift from '@tabler/icons-svelte/icons/gift';
	import Trash from '@tabler/icons-svelte/icons/trash';
	import Pencil from '@tabler/icons-svelte/icons/pencil';
	import { ApiClientError } from '$lib/api/client';
	import { formatDate, formatRelative } from '$lib/admin/format';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import Modal from '$lib/components/admin/Modal.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import StatCard from '$lib/components/admin/StatCard.svelte';
	import StatGrid from '$lib/components/admin/StatGrid.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';
	import MarketingTabs from '$lib/components/tenant/MarketingTabs.svelte';
	import { marketingApi, type LoyaltyProgram, type LoyaltyView, type Offer, type OfferInput } from '$lib/tenant/marketingApi';

	/**
	 * Offers and loyalty. Offers are coupon codes with rules the server
	 * enforces at checkout; loyalty is a points programme whose balances are
	 * a ledger. This screen only configures them and shows what they did.
	 */

	let offers = $state<Offer[]>([]);
	let loyalty = $state<LoyaltyView | null>(null);
	let loading = $state(true);
	let loadError = $state('');

	async function load() {
		loadError = '';
		try {
			const [o, l] = await Promise.all([marketingApi.offers(), marketingApi.loyalty()]);
			offers = o.offers ?? [];
			loyalty = l;
		} catch (err) {
			if (err instanceof ApiClientError && err.code === 'feature_not_in_plan') loadError = err.message;
			else loadError = err instanceof Error ? err.message : 'Could not load offers';
		} finally {
			loading = false;
		}
	}
	onMount(() => void load());

	/* ---------- offer form ---------- */

	const blank = (): OfferInput => ({
		code: '', name: '', kind: 'PERCENT', value: 10, min_subtotal: 0, max_discount: 0,
		starts_at: '', ends_at: '', max_redemptions: 0, per_customer_limit: 1, first_order_only: false, active: true
	});
	let formOpen = $state(false);
	let editing = $state<Offer | null>(null);
	let form = $state<OfferInput>(blank());
	let formError = $state('');
	let saving = $state(false);
	// Strings for the inputs; parsed on save.
	let valueStr = $state('10');
	let minStr = $state('');
	let capStr = $state('');
	let maxRedStr = $state('');
	let perCustStr = $state('1');
	let startsLocal = $state('');
	let endsLocal = $state('');

	function toLocal(iso: string | null): string {
		if (!iso) return '';
		const d = new Date(iso);
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}
	function toISO(local: string): string {
		if (!local) return '';
		const d = new Date(local);
		return Number.isNaN(d.getTime()) ? '' : d.toISOString();
	}

	function openNew() {
		editing = null;
		form = blank();
		valueStr = '10';
		minStr = '';
		capStr = '';
		maxRedStr = '';
		perCustStr = '1';
		startsLocal = '';
		endsLocal = '';
		formError = '';
		formOpen = true;
	}
	function openEdit(o: Offer) {
		editing = o;
		form = {
			code: o.code, name: o.name, kind: o.kind, value: o.value, min_subtotal: o.min_subtotal, max_discount: o.max_discount,
			starts_at: o.starts_at ?? '', ends_at: o.ends_at ?? '', max_redemptions: o.max_redemptions,
			per_customer_limit: o.per_customer_limit, first_order_only: o.first_order_only, active: o.active
		};
		valueStr = String(o.value);
		minStr = o.min_subtotal ? String(o.min_subtotal) : '';
		capStr = o.max_discount ? String(o.max_discount) : '';
		maxRedStr = o.max_redemptions ? String(o.max_redemptions) : '';
		perCustStr = String(o.per_customer_limit);
		startsLocal = toLocal(o.starts_at);
		endsLocal = toLocal(o.ends_at);
		formError = '';
		formOpen = true;
	}

	async function save() {
		saving = true;
		formError = '';
		const payload: OfferInput = {
			...form,
			code: form.code.trim().toUpperCase(),
			value: Number(valueStr) || 0,
			min_subtotal: Number(minStr) || 0,
			max_discount: Number(capStr) || 0,
			max_redemptions: Number(maxRedStr) || 0,
			per_customer_limit: Number(perCustStr) || 0,
			starts_at: toISO(startsLocal),
			ends_at: toISO(endsLocal)
		};
		try {
			if (editing) await marketingApi.updateOffer(editing.id, payload);
			else await marketingApi.createOffer(payload);
			toast.success(editing ? 'Offer updated' : 'Offer created');
			formOpen = false;
			await load();
		} catch (err) {
			formError = err instanceof Error ? err.message : 'Could not save the offer';
		} finally {
			saving = false;
		}
	}

	let deleteTarget = $state<Offer | null>(null);
	async function remove() {
		if (!deleteTarget) return;
		try {
			await marketingApi.deleteOffer(deleteTarget.id);
			toast.success('Offer deleted');
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not delete');
		} finally {
			deleteTarget = null;
		}
	}

	async function toggleActive(o: Offer) {
		try {
			await marketingApi.updateOffer(o.id, {
				code: o.code, name: o.name, kind: o.kind, value: o.value, min_subtotal: o.min_subtotal, max_discount: o.max_discount,
				starts_at: o.starts_at ?? '', ends_at: o.ends_at ?? '', max_redemptions: o.max_redemptions,
				per_customer_limit: o.per_customer_limit, first_order_only: o.first_order_only, active: !o.active
			});
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not update');
		}
	}

	function offerState(o: Offer): { label: string; kind: 'ok' | 'warn' | 'neutral' | 'danger' } {
		const now = Date.now();
		if (!o.active) return { label: 'Off', kind: 'neutral' };
		if (o.ends_at && new Date(o.ends_at).getTime() < now) return { label: 'Expired', kind: 'neutral' };
		if (o.starts_at && new Date(o.starts_at).getTime() > now) return { label: 'Starts ' + formatDate(o.starts_at), kind: 'warn' };
		if (o.max_redemptions > 0 && o.redemptions >= o.max_redemptions) return { label: 'Fully claimed', kind: 'warn' };
		return { label: 'Live', kind: 'ok' };
	}
	function describe(o: Offer): string {
		const amount = o.kind === 'PERCENT' ? `${o.value}% off` : `${o.value} off`;
		const parts = [amount];
		if (o.min_subtotal > 0) parts.push(`on orders over ${o.min_subtotal}`);
		if (o.max_discount > 0 && o.kind === 'PERCENT') parts.push(`up to ${o.max_discount}`);
		if (o.first_order_only) parts.push('first order only');
		if (o.per_customer_limit > 0) parts.push(o.per_customer_limit === 1 ? 'once per customer' : `${o.per_customer_limit} per customer`);
		return parts.join(', ');
	}

	/* ---------- loyalty ---------- */

	let prog = $state<LoyaltyProgram>({ enabled: false, points_per_100: 10, point_value: 0.1, min_redeem_points: 100, max_redeem_percent: 50 });
	let progSaving = $state(false);
	let progDirty = $state(false);
	$effect(() => {
		if (loyalty && !progDirty) prog = { ...loyalty.program };
	});
	async function saveProgram() {
		progSaving = true;
		try {
			const saved = await marketingApi.saveLoyalty(prog);
			prog = saved;
			progDirty = false;
			toast.success(saved.enabled ? 'Loyalty is on' : 'Loyalty saved');
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not save');
		} finally {
			progSaving = false;
		}
	}

	let adjustOpen = $state(false);
	let adjustMember = $state<LoyaltyView['members'][number] | null>(null);
	let adjustPoints = $state('');
	let adjustNote = $state('');
	let adjusting = $state(false);
	async function adjust() {
		if (!adjustMember) return;
		const n = Number(adjustPoints);
		if (!Number.isInteger(n) || n === 0) {
			toast.error('Enter a whole number of points, positive or negative');
			return;
		}
		adjusting = true;
		try {
			await marketingApi.adjustLoyalty(adjustMember.customer_id, n, adjustNote);
			toast.success('Points updated');
			adjustOpen = false;
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not adjust');
		} finally {
			adjusting = false;
		}
	}

	const totalRedemptions = $derived(offers.reduce((n, o) => n + o.redemptions, 0));
	const totalDiscount = $derived(offers.reduce((n, o) => n + o.discount_total, 0));
</script>

<div class="of-page">
	<MarketingTabs />

	{#if loadError}
		<div class="panel of-error" role="alert">
			<strong>Could not load offers.</strong>
			<span class="muted">{loadError}</span>
			<button type="button" class="btn btn-ghost btn-sm" onclick={load}>Try again</button>
		</div>
	{:else}
		<StatGrid>
			<StatCard label="Live offers" value={offers.filter((o) => offerState(o).label === 'Live').length} {loading}>
				{#snippet icon()}<Ticket size={15} stroke={1.6} />{/snippet}
			</StatCard>
			<StatCard label="Redemptions" value={totalRedemptions} hint={totalDiscount ? `${totalDiscount.toFixed(2)} given as discounts` : 'All time'} {loading} />
			<StatCard label="Loyalty members" value={loyalty?.summary.members ?? 0} hint={loyalty?.program.enabled ? 'Programme on' : 'Programme off'} {loading}>
				{#snippet icon()}<Gift size={15} stroke={1.6} />{/snippet}
			</StatCard>
			<StatCard label="Points outstanding" value={loyalty?.summary.outstanding_points ?? 0} hint={loyalty ? `Worth ${loyalty.outstanding_value.toFixed(2)}` : ''} {loading} />
		</StatGrid>

		<section class="panel panel-flush of-card" aria-labelledby="of-offers">
			<div class="of-head">
				<div>
					<h2 id="of-offers" class="of-h">Offers</h2>
					<p class="muted of-small">Codes customers enter at checkout. Every rule is checked by the server when the order is placed.</p>
				</div>
				<button type="button" class="btn btn-primary btn-sm" onclick={openNew}>New offer</button>
			</div>
			{#if loading}
				<p class="muted of-pad">Loading…</p>
			{:else if offers.length === 0}
				<p class="muted of-pad">No offers yet. A first-order code or a slow-day discount is a good place to start.</p>
			{:else}
				<ul class="of-list">
					{#each offers as o (o.id)}
						{@const st = offerState(o)}
						<li class="of-row">
							<span class="of-main">
								<strong class="of-code">{o.code}</strong>
								<span>{o.name || describe(o)}</span>
								<span class="muted of-small">{describe(o)}{o.ends_at ? ` · ends ${formatDate(o.ends_at)}` : ''}</span>
							</span>
							<span class="muted of-small of-nowrap">{o.redemptions} used{o.max_redemptions ? ` of ${o.max_redemptions}` : ''}</span>
							<StatusBadge status={st.label} kind={st.kind} />
							<span class="of-actions">
								<button type="button" class="btn btn-quiet btn-sm" title={o.active ? 'Turn off' : 'Turn on'} onclick={() => toggleActive(o)}>{o.active ? 'Turn off' : 'Turn on'}</button>
								<button type="button" class="btn btn-quiet btn-sm" title="Edit" aria-label="Edit offer" onclick={() => openEdit(o)}><Pencil size={15} stroke={1.6} /></button>
								<button type="button" class="btn btn-quiet btn-sm" title="Delete" aria-label="Delete offer" onclick={() => (deleteTarget = o)}><Trash size={15} stroke={1.6} /></button>
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<div class="of-two">
			<section class="panel of-card of-padded" aria-labelledby="of-loyalty">
				<h2 id="of-loyalty" class="of-h">Loyalty points</h2>
				<p class="muted of-small">Customers earn points on completed orders and spend them at checkout. Balances are a ledger you can audit.</p>
				<Switch bind:checked={prog.enabled} label="Loyalty programme on" onchange={() => (progDirty = true)} />
				<div class="of-grid">
					<FormField label="Points per 100 spent" htmlFor="ly-earn">
						<TextInput id="ly-earn" type="number" min={0} value={String(prog.points_per_100)} oninput={(e) => { prog.points_per_100 = Number((e.target as HTMLInputElement).value) || 0; progDirty = true; }} />
					</FormField>
					<FormField label="Value of one point" htmlFor="ly-value" hint="In your currency">
						<TextInput id="ly-value" type="number" min={0} step="0.01" value={String(prog.point_value)} oninput={(e) => { prog.point_value = Number((e.target as HTMLInputElement).value) || 0; progDirty = true; }} />
					</FormField>
					<FormField label="Minimum to redeem" htmlFor="ly-min" hint="Points">
						<TextInput id="ly-min" type="number" min={0} value={String(prog.min_redeem_points)} oninput={(e) => { prog.min_redeem_points = Number((e.target as HTMLInputElement).value) || 0; progDirty = true; }} />
					</FormField>
					<FormField label="Max share of an order" htmlFor="ly-max" hint="Percent of the subtotal points can cover">
						<TextInput id="ly-max" type="number" min={0} max={100} value={String(prog.max_redeem_percent)} oninput={(e) => { prog.max_redeem_percent = Number((e.target as HTMLInputElement).value) || 0; progDirty = true; }} />
					</FormField>
				</div>
				<p class="muted of-small">
					Example: a 500 order earns {Math.floor((500 / 100) * prog.points_per_100)} points, worth {(Math.floor((500 / 100) * prog.points_per_100) * prog.point_value).toFixed(2)}.
				</p>
				<div>
					<button type="button" class="btn btn-primary" disabled={progSaving || !progDirty} onclick={saveProgram}>{progSaving ? 'Saving…' : 'Save programme'}</button>
				</div>
			</section>

			<section class="panel panel-flush of-card" aria-labelledby="of-members">
				<div class="of-head">
					<h2 id="of-members" class="of-h">Top members</h2>
				</div>
				{#if !loyalty || loyalty.members.length === 0}
					<p class="muted of-pad">No points earned yet. Points are credited when an order is completed.</p>
				{:else}
					<ul class="of-list">
						{#each loyalty.members as m (m.customer_id)}
							<li class="of-row">
								<span class="of-main">
									<strong>{m.name || m.phone}</strong>
									<span class="muted of-small">{m.phone} · {m.lifetime_earned} earned · {formatRelative(m.updated_at)}</span>
								</span>
								<strong>{m.balance}</strong>
								<button type="button" class="btn btn-quiet btn-sm" onclick={() => { adjustMember = m; adjustPoints = ''; adjustNote = ''; adjustOpen = true; }}>Adjust</button>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		</div>
	{/if}
</div>

<Modal bind:open={formOpen} title={editing ? `Edit ${editing.code}` : 'New offer'}>
	<div class="of-form">
		<FormField label="Code" htmlFor="of-code" hint="What customers type. Letters, numbers, - and _." required>
			<TextInput id="of-code" bind:value={form.code} placeholder="WELCOME10" maxlength={32} disabled={editing !== null} />
		</FormField>
		<FormField label="Name" htmlFor="of-name" hint="For you. Shown to customers when the code applies.">
			<TextInput id="of-name" bind:value={form.name} placeholder="Welcome offer" maxlength={80} />
		</FormField>
		<div class="of-grid">
			<FormField label="Type" htmlFor="of-kind">
				<SelectField id="of-kind" bind:value={form.kind} options={[{ value: 'PERCENT', label: 'Percent off' }, { value: 'FIXED', label: 'Fixed amount off' }]} />
			</FormField>
			<FormField label={form.kind === 'PERCENT' ? 'Percent' : 'Amount'} htmlFor="of-value" required>
				<TextInput id="of-value" type="number" min={0} step="0.01" bind:value={valueStr} />
			</FormField>
			<FormField label="Minimum order" htmlFor="of-min" hint="Blank for none">
				<TextInput id="of-min" type="number" min={0} step="0.01" bind:value={minStr} />
			</FormField>
			{#if form.kind === 'PERCENT'}
				<FormField label="Maximum discount" htmlFor="of-cap" hint="Blank for none">
					<TextInput id="of-cap" type="number" min={0} step="0.01" bind:value={capStr} />
				</FormField>
			{/if}
			<FormField label="Starts" htmlFor="of-starts" hint="Blank for now">
				<input id="of-starts" class="input" type="datetime-local" bind:value={startsLocal} />
			</FormField>
			<FormField label="Ends" htmlFor="of-ends" hint="Blank for never">
				<input id="of-ends" class="input" type="datetime-local" bind:value={endsLocal} />
			</FormField>
			<FormField label="Total uses" htmlFor="of-maxred" hint="Blank for unlimited">
				<TextInput id="of-maxred" type="number" min={0} bind:value={maxRedStr} />
			</FormField>
			<FormField label="Uses per customer" htmlFor="of-percust" hint="0 for unlimited">
				<TextInput id="of-percust" type="number" min={0} bind:value={perCustStr} />
			</FormField>
		</div>
		<Switch bind:checked={form.first_order_only} label="First order only" hint="Only customers who have never ordered before can use it." />
		{#if formError}<p class="field-error" role="alert">{formError}</p>{/if}
	</div>
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (formOpen = false)}>Cancel</button>
		<button type="button" class="btn btn-primary" disabled={saving || !form.code.trim() || !valueStr} onclick={save}>{saving ? 'Saving…' : editing ? 'Save' : 'Create offer'}</button>
	{/snippet}
</Modal>

<Modal bind:open={adjustOpen} title={adjustMember ? `Adjust points for ${adjustMember.name || adjustMember.phone}` : 'Adjust points'}>
	<div class="of-form">
		<FormField label="Points" htmlFor="of-adj" hint="Positive to add, negative to remove." required>
			<TextInput id="of-adj" type="number" bind:value={adjustPoints} placeholder="50" />
		</FormField>
		<FormField label="Note" htmlFor="of-adj-note" hint="Why. Kept in the ledger.">
			<TextInput id="of-adj-note" bind:value={adjustNote} placeholder="Birthday bonus" maxlength={120} />
		</FormField>
	</div>
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (adjustOpen = false)}>Cancel</button>
		<button type="button" class="btn btn-primary" disabled={adjusting || !adjustPoints} onclick={adjust}>{adjusting ? 'Saving…' : 'Apply'}</button>
	{/snippet}
</Modal>

<ConfirmDialog
	open={deleteTarget !== null}
	title="Delete this offer?"
	message="Customers can no longer use the code. Orders that already used it keep their discount."
	confirmLabel="Delete"
	danger
	onconfirm={remove}
/>

<style>
	.of-page { display: grid; gap: 1rem; }
	.of-h { margin: 0; font-size: var(--fs-body); font-weight: 600; }
	.of-small { margin: 0; font-size: var(--fs-meta); line-height: 1.45; }
	.of-nowrap { white-space: nowrap; }
	.of-card { display: grid; gap: 0.6rem; align-content: start; }
	.of-padded { padding: 1rem; }
	.of-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; padding: 0.9rem 1rem 0.5rem; }
	.of-pad { padding: 0.25rem 1rem 1rem; margin: 0; }
	.of-two { display: grid; grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr)); gap: 1rem; }
	.of-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 0.75rem; }
	.of-list { list-style: none; margin: 0; padding: 0; }
	.of-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.7rem 1rem; border-top: 1px solid var(--border, color-mix(in srgb, var(--text) 10%, transparent)); }
	.of-main { display: grid; gap: 0.1rem; min-width: 0; flex: 1; }
	.of-main .muted { overflow-wrap: anywhere; }
	.of-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.04em; }
	.of-actions { display: flex; gap: 0.15rem; }
	.of-form { display: grid; gap: 0.9rem; }
	.of-error { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; padding: 1rem; }
	.field-error { margin: 0; }
</style>
