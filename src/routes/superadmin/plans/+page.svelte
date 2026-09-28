<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import {
		changeTenantPlan,
		createPlan,
		fetchPlans,
		fetchSubscriptions,
		fetchTenantTypes,
		toPlanOption,
		updatePlan
	} from '$lib/admin/api';
	import { errorMessage } from '$lib/admin/errors';
	import { formatDate } from '$lib/admin/format';
	import type { Plan, PlanWritePayload, Subscription, TenantType } from '$lib/admin/types';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import DataTable from '$lib/components/admin/DataTable.svelte';
	import EmptyState from '$lib/components/admin/EmptyState.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import FilterBar from '$lib/components/admin/FilterBar.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import Menu from '$lib/components/admin/Menu.svelte';
	import Modal from '$lib/components/admin/Modal.svelte';
	import PlanPicker from '$lib/components/admin/PlanPicker.svelte';
	import SearchInput from '$lib/components/admin/SearchInput.svelte';
	import Select from '$lib/components/admin/Select.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import SlideOver from '$lib/components/admin/SlideOver.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import Switch from '$lib/components/admin/Switch.svelte';
	import Tabs from '$lib/components/admin/Tabs.svelte';
	import TextArea from '$lib/components/admin/TextArea.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';

	/**
	 * Plans and subscriptions.
	 *
	 * Plans are the catalogue: what is on offer, at what price, with what
	 * limits, to which business types. Subscriptions are the consequence: which
	 * business is on which plan, and when that runs out.
	 *
	 * No money moves anywhere in this build. The screens say so rather than
	 * implying a billing system that does not exist.
	 */

	const tabs = [
		{ id: 'plans', label: 'Plans' },
		{ id: 'subscriptions', label: 'Subscriptions' }
	];

	const BILLING_PERIODS = [
		{ value: 'trial', label: 'Trial only' },
		{ value: 'monthly', label: 'Monthly' },
		{ value: 'yearly', label: 'Yearly' },
		{ value: 'one_time', label: 'One-time' }
	];

	let tab = $state('plans');
	let plans = $state<Plan[]>([]);
	let subscriptions = $state<Subscription[]>([]);
	let types = $state<TenantType[]>([]);
	let loading = $state(true);
	let error = $state('');

	let search = $state('');
	let statusFilter = $state('');
	let planFilter = $state('');

	/* ---------- plan editor ---------- */
	let editorOpen = $state(false);
	let editing = $state<Plan | null>(null);
	let saving = $state(false);
	let form = $state(blankForm());
	let featureDraft = $state('');
	let formErrors = $state<Record<string, string>>({});

	/* ---------- confirmations ---------- */
	let confirmOpen = $state(false);
	let confirmTarget = $state<Plan | null>(null);
	let confirmLoading = $state(false);

	/* ---------- move a business ---------- */
	let moveOpen = $state(false);
	let moveTarget = $state<Subscription | null>(null);
	let moveChoice = $state('');
	let moveSaving = $state(false);

	function blankForm() {
		return {
			name: '',
			description: '',
			price: 0,
			billing_period: 'monthly',
			trial_days: 0,
			max_staff: 5,
			max_products: 100,
			features: [] as string[],
			business_types: [] as string[],
			is_active: true
		};
	}

	async function load() {
		loading = true;
		error = '';
		try {
			const [p, s, t] = await Promise.all([fetchPlans(), fetchSubscriptions(), fetchTenantTypes()]);
			plans = p;
			subscriptions = s;
			types = t;
		} catch (err) {
			error = errorMessage(err, 'load plans and subscriptions');
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		const q = $page.url.searchParams.get('tab');
		if (q && tabs.some((t) => t.id === q)) tab = q;
		void load();
	});

	function setTab(next: string) {
		tab = next;
		goto(`?tab=${next}`, { replaceState: true, keepFocus: true, noScroll: true });
	}

	const planOptions = $derived(plans.filter((p) => p.is_active).map(toPlanOption));

	const filteredSubscriptions = $derived.by(() => {
		let rows = [...subscriptions];
		const q = search.trim().toLowerCase();
		if (q) rows = rows.filter((s) => s.tenant_name.toLowerCase().includes(q));
		if (statusFilter) rows = rows.filter((s) => s.status === statusFilter);
		if (planFilter) rows = rows.filter((s) => String(s.plan_name).toUpperCase() === planFilter);
		return rows.sort((a, b) => a.tenant_name.localeCompare(b.tenant_name));
	});

	/** How many businesses sit on a plan, as reported by the list endpoint. */
	function usage(plan: Plan): number {
		return plan.tenant_count ?? 0;
	}

	function typeLabel(code: string): string {
		return types.find((t) => t.code === code)?.label ?? code;
	}

	/* ---------- plan editing ---------- */

	function openCreate() {
		editing = null;
		form = blankForm();
		featureDraft = '';
		formErrors = {};
		editorOpen = true;
	}

	function openEdit(plan: Plan) {
		editing = plan;
		form = {
			name: plan.name,
			description: plan.description,
			price: plan.price,
			billing_period: String(plan.billing_period),
			trial_days: plan.trial_days,
			max_staff: plan.max_staff,
			max_products: plan.max_products,
			features: [...plan.features],
			business_types: [...plan.business_types],
			is_active: plan.is_active
		};
		featureDraft = '';
		formErrors = {};
		editorOpen = true;
	}

	function validate(): boolean {
		const errs: Record<string, string> = {};
		if (!form.name.trim()) errs.name = 'A plan needs a name';
		else if (!/^[A-Za-z0-9 _-]{2,32}$/.test(form.name.trim()))
			errs.name = 'Use letters, numbers, spaces, hyphens or underscores';
		if (form.price < 0) errs.price = 'Price cannot be negative';
		if (form.max_staff < 0) errs.max_staff = 'Cannot be negative';
		if (form.max_products < 0) errs.max_products = 'Cannot be negative';
		if (form.trial_days < 0 || form.trial_days > 365) errs.trial_days = 'Between 0 and 365 days';
		formErrors = errs;
		return Object.keys(errs).length === 0;
	}

	function addFeature() {
		const value = featureDraft.trim();
		if (!value) return;
		if (form.features.includes(value)) {
			featureDraft = '';
			return;
		}
		form.features = [...form.features, value];
		featureDraft = '';
	}

	function removeFeature(value: string) {
		form.features = form.features.filter((f) => f !== value);
	}

	function toggleType(code: string) {
		form.business_types = form.business_types.includes(code)
			? form.business_types.filter((c) => c !== code)
			: [...form.business_types, code];
	}

	async function savePlan() {
		if (!validate()) return;
		saving = true;
		const payload: PlanWritePayload = {
			name: form.name.trim().toUpperCase(),
			description: form.description.trim(),
			price: Number(form.price) || 0,
			max_staff: Number(form.max_staff) || 0,
			max_products: Number(form.max_products) || 0,
			billing_period: form.billing_period,
			trial_days: Number(form.trial_days) || 0,
			features: form.features,
			business_types: form.business_types,
			is_active: form.is_active
		};
		try {
			if (editing) {
				const updated = await updatePlan(editing.id, payload);
				plans = plans.map((p) => (p.id === updated.id ? { ...p, ...updated } : p));
				toast.success(`${updated.name} saved`);
			} else {
				const createdPlan = await createPlan(payload);
				plans = [...plans, createdPlan].sort((a, b) => a.price - b.price);
				toast.success(`${createdPlan.name} created`);
			}
			editorOpen = false;
		} catch (err) {
			toast.error(errorMessage(err, editing ? 'save this plan' : 'create the plan'));
		} finally {
			saving = false;
		}
	}

	function askDeactivate(plan: Plan) {
		confirmTarget = plan;
		confirmOpen = true;
	}

	async function setActive(plan: Plan, active: boolean) {
		try {
			const updated = await updatePlan(plan.id, { is_active: active });
			plans = plans.map((p) => (p.id === updated.id ? { ...p, ...updated } : p));
			toast.success(active ? `${updated.name} is on offer again` : `${updated.name} withdrawn`);
			confirmOpen = false;
		} catch (err) {
			toast.error(errorMessage(err, active ? 'activate this plan' : 'deactivate this plan'));
		}
	}

	async function runDeactivate() {
		if (!confirmTarget) return;
		confirmLoading = true;
		await setActive(confirmTarget, false);
		confirmLoading = false;
	}

	/* ---------- moving a business ---------- */

	function openMove(subscription: Subscription) {
		moveTarget = subscription;
		moveChoice = String(subscription.plan_name).toUpperCase();
		moveOpen = true;
	}

	async function saveMove() {
		if (!moveTarget || !moveChoice) return;
		moveSaving = true;
		try {
			await changeTenantPlan(moveTarget.tenant_id, moveChoice);
			subscriptions = await fetchSubscriptions();
			plans = await fetchPlans();
			toast.success(`${moveTarget.tenant_name} moved`);
			moveOpen = false;
		} catch (err) {
			toast.error(errorMessage(err, 'change the plan'));
		} finally {
			moveSaving = false;
		}
	}

	function billingLabel(period: string): string {
		return BILLING_PERIODS.find((p) => p.value === period)?.label ?? period;
	}
</script>

{#if error}
	<div class="panel" style="margin-bottom:1rem;">
		<ErrorState message={error} onretry={load} />
	</div>
{/if}

<Tabs {tabs} bind:active={tab} onchange={setTab} />

{#if tab === 'plans'}
	<section class="panel panel-flush">
		<div class="sec-head">
			<div>
				<h2>Plans on offer</h2>
				<p>
					What a business can be provisioned on. Limits are enforced as staff and products are
					added; the platform takes no payment, so a plan records the commercial terms rather than
					charging them.
				</p>
			</div>
			<button type="button" class="btn btn-primary btn-sm" onclick={openCreate}>
				<Plus size={15} strokeWidth={2.2} />
				New plan
			</button>
		</div>

		<DataTable
			{loading}
			empty={!loading && plans.length === 0}
			emptyTitle="No plans yet"
			emptyDescription="Create a plan before onboarding a business — every business needs one."
		>
			{#snippet head()}
				<th>Plan</th>
				<th class="col-md">Price</th>
				<th class="col-md">Billing</th>
				<th class="col-sm">Limits</th>
				<th class="col-sm">Offered to</th>
				<th>Status</th>
				<th class="col-md">In use</th>
				<th style="width:1%;"><span class="sr-only">Actions</span></th>
			{/snippet}

			{#each plans as plan (plan.id)}
				<tr>
					<td>
						<strong style="font-weight:600;">{plan.name}</strong>
						{#if plan.description}
							<span class="muted" style="display:block;font-size:0.74rem;">{plan.description}</span>
						{/if}
						{#if plan.features.length > 0}
							<span class="feat-row">
								{#each plan.features.slice(0, 3) as feature (feature)}
									<span class="feat">{feature}</span>
								{/each}
								{#if plan.features.length > 3}
									<span class="muted" style="font-size:0.7rem;">+{plan.features.length - 3}</span>
								{/if}
							</span>
						{/if}
					</td>
					<td class="num col-md">
						{plan.price === 0 ? 'Free' : `₹${plan.price.toLocaleString('en-IN')}`}
					</td>
					<td class="col-md" style="color:var(--text-2);">
						{billingLabel(String(plan.billing_period))}
						{#if plan.trial_days > 0}
							<span class="muted" style="display:block;font-size:0.72rem;">
								{plan.trial_days}-day trial
							</span>
						{/if}
					</td>
					<td class="col-sm" style="color:var(--text-2);">
						{plan.max_staff} staff · {plan.max_products} products
					</td>
					<td class="col-sm" style="color:var(--text-2);">
						{#if plan.business_types.length === 0}
							<span class="muted">All types</span>
						{:else}
							{plan.business_types.map(typeLabel).join(', ')}
						{/if}
					</td>
					<td><StatusBadge status={plan.is_active ? 'ACTIVE' : 'INACTIVE'} /></td>
					<td class="num muted col-md">
						{usage(plan)}
						{usage(plan) === 1 ? 'business' : 'businesses'}
					</td>
					<td>
						<Menu
							label={`Actions for ${plan.name}`}
							items={[
								{ label: 'Edit plan', onclick: () => openEdit(plan) },
								plan.is_active
									? {
											label: 'Deactivate',
											danger: true,
											separatorBefore: true,
											onclick: () => askDeactivate(plan)
										}
									: {
											label: 'Activate',
											separatorBefore: true,
											onclick: () => setActive(plan, true)
										}
							]}
						/>
					</td>
				</tr>
			{/each}
		</DataTable>
	</section>
{:else}
	<section class="panel panel-flush">
		<div class="sec-head">
			<div>
				<h2>Subscriptions</h2>
				<p>
					One row per business: what it is provisioned on, and when that runs out. A trial that
					lapses does not suspend anything on its own — it is a prompt for you.
				</p>
			</div>
		</div>

		<div style="padding:0 1.25rem 1rem;">
			<FilterBar>
				<SearchInput bind:value={search} placeholder="Business name…" label="" />
				<Select
					bind:value={statusFilter}
					label="Status"
					id="sub-status"
					allLabel="Any status"
					options={[
						{ value: 'TRIAL', label: 'Trial' },
						{ value: 'ACTIVE', label: 'Active' },
						{ value: 'EXPIRED', label: 'Expired' },
						{ value: 'CANCELLED', label: 'Cancelled' }
					]}
				/>
				<Select
					bind:value={planFilter}
					label="Plan"
					id="sub-plan"
					allLabel="Any plan"
					options={plans.map((p) => ({ value: p.name.toUpperCase(), label: p.name }))}
				/>
			</FilterBar>
		</div>

		{#if !loading && filteredSubscriptions.length === 0 && subscriptions.length > 0}
			<EmptyState
				title="No subscriptions match"
				description="Try a different search term or clear the filters."
			>
				{#snippet action()}
					<button
						type="button"
						class="btn btn-ghost btn-sm"
						onclick={() => {
							search = '';
							statusFilter = '';
							planFilter = '';
						}}
					>
						Clear filters
					</button>
				{/snippet}
			</EmptyState>
		{:else}
			<DataTable
				{loading}
				empty={!loading && filteredSubscriptions.length === 0}
				emptyTitle="No subscriptions yet"
				emptyDescription="A subscription is created with each business you onboard."
			>
				{#snippet head()}
					<th>Business</th>
					<th>Plan</th>
					<th>Status</th>
					<th class="col-md">Trial ends</th>
					<th class="col-sm">Started</th>
					<th class="col-md">Renews</th>
					<th style="width:1%;"><span class="sr-only">Actions</span></th>
				{/snippet}

				{#each filteredSubscriptions as sub (sub.id)}
					<tr>
						<td>
							<a href={`/superadmin/businesses/${sub.tenant_id}`} style="font-weight:550;">
								{sub.tenant_name}
							</a>
						</td>
						<td><StatusBadge status={String(sub.plan_name)} kind="accent" dot={false} /></td>
						<td><StatusBadge status={String(sub.status)} /></td>
						<td class="col-md muted">{sub.trial_end ? formatDate(sub.trial_end) : '—'}</td>
						<td class="col-sm muted">{formatDate(sub.start_date)}</td>
						<td class="col-md muted">{sub.renewal_date ? formatDate(sub.renewal_date) : '—'}</td>
						<td>
							<Menu
								label={`Actions for ${sub.tenant_name}`}
								items={[
									{ label: 'Open business', href: `/superadmin/businesses/${sub.tenant_id}` },
									{ label: 'Change plan', onclick: () => openMove(sub) }
								]}
							/>
						</td>
					</tr>
				{/each}
			</DataTable>
		{/if}
	</section>
{/if}

<SlideOver bind:open={editorOpen} title={editing ? `Edit ${editing.name}` : 'New plan'}>
	<div style="display:flex;flex-direction:column;gap:0.9rem;">
		<FormField
			label="Plan name"
			htmlFor="plan-name"
			required
			error={formErrors.name}
			hint={editing && usage(editing) > 0
				? 'Businesses are on this plan, so it cannot be renamed.'
				: 'Stored in upper case, e.g. STARTER.'}
		>
			<TextInput
				id="plan-name"
				bind:value={form.name}
				placeholder="STARTER"
				disabled={Boolean(editing && usage(editing) > 0)}
			/>
		</FormField>

		<FormField label="Description" htmlFor="plan-desc">
			<TextArea
				id="plan-desc"
				bind:value={form.description}
				rows={2}
				placeholder="For small shops getting started."
			/>
		</FormField>

		<div style="display:grid;gap:0.9rem;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr));">
			<FormField label="Price" htmlFor="plan-price" error={formErrors.price}>
				<TextInput
					id="plan-price"
					type="number"
					min={0}
					suffix="₹"
					value={String(form.price)}
					oninput={(e) => (form.price = Number((e.currentTarget as HTMLInputElement).value))}
				/>
			</FormField>
			<FormField label="Billing period" htmlFor="plan-billing">
				<SelectField id="plan-billing" bind:value={form.billing_period} options={BILLING_PERIODS} />
			</FormField>
			<FormField
				label="Trial length"
				htmlFor="plan-trial"
				error={formErrors.trial_days}
				hint="0 for no trial."
			>
				<TextInput
					id="plan-trial"
					type="number"
					min={0}
					max={365}
					suffix="days"
					value={String(form.trial_days)}
					oninput={(e) => (form.trial_days = Number((e.currentTarget as HTMLInputElement).value))}
				/>
			</FormField>
		</div>

		<div style="display:grid;gap:0.9rem;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr));">
			<FormField label="Staff limit" htmlFor="plan-staff" error={formErrors.max_staff}>
				<TextInput
					id="plan-staff"
					type="number"
					min={0}
					value={String(form.max_staff)}
					oninput={(e) => (form.max_staff = Number((e.currentTarget as HTMLInputElement).value))}
				/>
			</FormField>
			<FormField label="Product limit" htmlFor="plan-products" error={formErrors.max_products}>
				<TextInput
					id="plan-products"
					type="number"
					min={0}
					value={String(form.max_products)}
					oninput={(e) => (form.max_products = Number((e.currentTarget as HTMLInputElement).value))}
				/>
			</FormField>
		</div>

		<div class="field">
			<span class="field-label">What the plan includes</span>
			<div style="display:flex;gap:0.5rem;align-items:flex-start;">
				<TextInput bind:value={featureDraft} placeholder="Unlimited orders" />
				<button type="button" class="btn btn-ghost btn-sm" onclick={addFeature}>Add</button>
			</div>
			{#if form.features.length > 0}
				<div class="chips">
					{#each form.features as feature (feature)}
						<span class="chip">
							{feature}
							<button
								type="button"
								aria-label={`Remove ${feature}`}
								onclick={() => removeFeature(feature)}
							>
								<X size={11} strokeWidth={2.4} />
							</button>
						</span>
					{/each}
				</div>
			{:else}
				<p class="field-hint">Listed on the plan card during onboarding.</p>
			{/if}
		</div>

		<div class="field">
			<span class="field-label">Offered to</span>
			<p class="field-hint" style="margin:0 0 0.5rem;">
				Select none to offer this plan to every business type.
			</p>
			<div class="chips">
				{#each types.filter((t) => t.active) as type (type.code)}
					<button
						type="button"
						class={['chip-toggle', form.business_types.includes(type.code) ? 'on' : ''].join(' ')}
						aria-pressed={form.business_types.includes(type.code)}
						onclick={() => toggleType(type.code)}
					>
						{type.label}
					</button>
				{/each}
			</div>
		</div>

		<Switch
			bind:checked={form.is_active}
			label="On offer"
			hint="A withdrawn plan stays on the businesses already using it."
		/>
	</div>

	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (editorOpen = false)}>Cancel</button>
		<button type="button" class="btn btn-primary" disabled={saving} onclick={savePlan}>
			{saving ? 'Saving…' : editing ? 'Save plan' : 'Create plan'}
		</button>
	{/snippet}
</SlideOver>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Withdraw this plan?"
	message={confirmTarget
		? usage(confirmTarget) > 0
			? `${usage(confirmTarget)} business${usage(confirmTarget) === 1 ? '' : 'es'} stay on ${confirmTarget.name} and keep its limits. It simply stops being offered when onboarding.`
			: `${confirmTarget.name} stops being offered when onboarding a business. Nothing else changes.`
		: ''}
	confirmLabel="Withdraw plan"
	danger
	loading={confirmLoading}
	onconfirm={runDeactivate}
/>

<Modal
	bind:open={moveOpen}
	title={moveTarget ? `Change plan — ${moveTarget.tenant_name}` : 'Change plan'}
>
	<p class="muted" style="margin:0 0 0.9rem;font-size:0.82rem;line-height:1.5;">
		The business moves immediately and its subscription follows. Nothing is charged.
	</p>
	<PlanPicker plans={planOptions} bind:value={moveChoice} />
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (moveOpen = false)}>Cancel</button>
		<button
			type="button"
			class="btn btn-primary"
			disabled={moveSaving ||
				!moveChoice ||
				moveChoice === String(moveTarget?.plan_name ?? '').toUpperCase()}
			onclick={saveMove}
		>
			{moveSaving ? 'Moving…' : 'Change plan'}
		</button>
	{/snippet}
</Modal>

<style>
	.sec-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.85rem;
		padding: 1.1rem 1.25rem 0.85rem;
	}

	.sec-head h2 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.sec-head p {
		margin: 0.25rem 0 0;
		font-size: 0.79rem;
		line-height: 1.5;
		color: var(--text-3);
		max-width: 44rem;
	}

	.feat-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
		margin-top: 0.35rem;
	}

	.feat {
		font-size: 0.68rem;
		padding: 0.1rem 0.4rem;
		border-radius: 999px;
		background: var(--surface-3);
		color: var(--text-3);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: 0.5rem;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.74rem;
		padding: 0.2rem 0.3rem 0.2rem 0.55rem;
		border-radius: 999px;
		background: var(--surface-3);
		color: var(--text-2);
	}

	.chip button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1rem;
		height: 1rem;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--text-3);
		cursor: pointer;
	}

	.chip button:hover {
		background: var(--danger-bg);
		color: var(--danger);
	}

	.chip-toggle {
		font-size: 0.74rem;
		font-weight: 550;
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		border: 1.5px solid var(--border);
		background: var(--surface);
		color: var(--text-2);
		cursor: pointer;
		transition:
			border-color var(--tr),
			background var(--tr),
			color var(--tr);
	}

	.chip-toggle.on {
		border-color: var(--accent);
		background: var(--accent-soft);
		color: var(--accent-dark);
	}
</style>
