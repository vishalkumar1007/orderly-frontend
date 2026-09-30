<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import {
		changeTenantPlan,
		fetchAuditLogs,
		fetchPlanOptions,
		fetchTenant,
		fetchTenantMetrics,
		fetchTenantTypes,
		resendTenantInvite,
		setTenantStatus,
		tenantPublicUrl,
		updateTenantLocal
	} from '$lib/admin/api';
	import { labelForType, templateFor } from '$lib/admin/businessTypes';
	import { errorMessage } from '$lib/admin/errors';
	import {
		formatDate,
		formatDateTime,
		formatRelative,
		rupees,
		toNumber
	} from '$lib/admin/format';
	import type {
		AuditLog,
		PlanOption,
		Tenant,
		TenantMetrics,
		TenantType
	} from '$lib/admin/types';
	import Copy from '@lucide/svelte/icons/copy';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import IndianRupee from '@lucide/svelte/icons/indian-rupee';
	import Mail from '@lucide/svelte/icons/mail';
	import ReceiptText from '@lucide/svelte/icons/receipt-text';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Store from '@lucide/svelte/icons/store';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import Users from '@lucide/svelte/icons/users';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import DataTable from '$lib/components/admin/DataTable.svelte';
	import EmptyState from '$lib/components/admin/EmptyState.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import LineChartPanel from '$lib/components/admin/LineChartPanel.svelte';
	import Menu from '$lib/components/admin/Menu.svelte';
	import Modal from '$lib/components/admin/Modal.svelte';
	import PlanPicker from '$lib/components/admin/PlanPicker.svelte';
	import Select from '$lib/components/admin/Select.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import SeriesBars from '$lib/components/admin/SeriesBars.svelte';
	import SlideOver from '$lib/components/admin/SlideOver.svelte';
	import StatCard from '$lib/components/admin/StatCard.svelte';
	import StatGrid from '$lib/components/admin/StatGrid.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import StatusBreakdown from '$lib/components/admin/StatusBreakdown.svelte';
	import Tabs from '$lib/components/admin/Tabs.svelte';
	import TenantAvatar from '$lib/components/admin/TenantAvatar.svelte';
	import TenantConfigAccessPanel from '$lib/components/admin/TenantConfigAccessPanel.svelte';
	import TextArea from '$lib/components/admin/TextArea.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';

	/**
	 * One business, as a workspace.
	 *
	 * Six tabs, each answering one question an operator arrives with: how is it
	 * doing, who can sign in, what is it paying for, what is configured, what
	 * has it been doing, and who changed something. Secrets appear on none of
	 * them — the Configuration tab reports posture and never a credential.
	 */

	let business = $state<Tenant | null>(null);
	let metrics = $state<TenantMetrics | null>(null);
	let logs = $state<AuditLog[]>([]);
	let types = $state<TenantType[]>([]);
	let plans = $state<PlanOption[]>([]);
	let loading = $state(true);
	let error = $state('');

	let tab = $state('overview');

	let confirmOpen = $state(false);
	let confirmAction = $state<'suspend' | 'activate'>('suspend');
	let confirmLoading = $state(false);

	let editOpen = $state(false);
	let saving = $state(false);
	let editForm = $state({
		name: '',
		owner_name: '',
		phone: '',
		email: '',
		address: '',
		business_type: ''
	});

	let planOpen = $state(false);
	let planChoice = $state('');
	let planSaving = $state(false);

	let inviteSetupUrl = $state('');
	let inviteNote = $state('');
	let inviteLoading = $state(false);

	let auditResult = $state('');

	const tabs = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'subscription', label: 'Subscription' },
		{ id: 'configuration', label: 'Configuration' },
		{ id: 'activity', label: 'Activity' },
		{ id: 'audit', label: 'Audit' }
	];

	const id = $derived($page.params.id ?? '');

	async function load() {
		if (!id) return;
		loading = true;
		error = '';
		try {
			const [t, m, l, ty, pl] = await Promise.all([
				fetchTenant(id),
				fetchTenantMetrics(id),
				fetchAuditLogs(id),
				fetchTenantTypes(),
				fetchPlanOptions()
			]);
			business = t;
			metrics = m;
			logs = l;
			types = ty;
			plans = pl;
		} catch (err) {
			error = errorMessage(err, 'load this business');
			business = null;
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
		// The tab is part of the address, so a link to a tab lands on that tab.
		goto(`?tab=${next}`, { replaceState: true, keepFocus: true, noScroll: true });
	}

	/* ---------- derived ---------- */

	const template = $derived(templateFor(business?.business_type));
	const terms = $derived(template.terminology);
	const typeLabel = $derived(labelForType(business?.business_type, types));

	const orderSeries = $derived(
		(metrics?.orders_by_day ?? []).map((d) => ({
			day: String(d.day ?? ''),
			order_count: Number(d.order_count ?? 0),
			revenue: toNumber(d.revenue)
		}))
	);
	const revenueSeries = $derived(
		orderSeries.map((d) => ({ label: d.day.slice(5), value: d.revenue }))
	);
	const aov = $derived(toNumber(metrics?.avg_order_value));
	const completionRate = $derived.by(() => {
		const rows = metrics?.status_breakdown ?? [];
		const total = rows.reduce((s, r) => s + r.count, 0);
		if (!total) return null;
		const done = rows.find((r) => r.status === 'COMPLETED')?.count ?? 0;
		return Math.round((done / total) * 100);
	});
	const security = $derived(metrics?.security);
	const subscription = $derived(
		(metrics?.subscription ?? business?.subscription ?? null) as Record<string, unknown> | null
	);
	const currentPlan = $derived(String(business?.plan ?? metrics?.current_plan ?? ''));
	const planOption = $derived(plans.find((p) => p.code === currentPlan.toUpperCase()));

	/**
	 * Security-relevant events only.
	 *
	 * The Activity tab is the full record; Audit is the subset a reviewer cares
	 * about — who got access, what changed hands, and what was refused.
	 */
	const auditLogs = $derived.by(() => {
		const sensitive =
			/(created|suspend|activat|plan|user|permission|access|configur|password|login|invite|deleted|disabled)/i;
		let rows = logs.filter(
			(l) => sensitive.test(l.action) || l.result === 'DENIED' || l.result === 'FAILURE'
		);
		if (auditResult) rows = rows.filter((l) => l.result === auditResult);
		return rows;
	});

	const storeUrl = $derived(business ? tenantPublicUrl(business) : '');

	/* ---------- actions ---------- */

	function openEdit() {
		if (!business) return;
		editForm = {
			name: business.name,
			owner_name: business.owner_name || '',
			phone: business.phone || '',
			email: business.email || '',
			address: business.address || '',
			business_type: business.business_type || ''
		};
		editOpen = true;
	}

	async function saveEdit() {
		if (!business) return;
		saving = true;
		try {
			business = { ...business, ...(await updateTenantLocal(business.id, editForm)) };
			toast.success('Business updated');
			editOpen = false;
		} catch (err) {
			toast.error(errorMessage(err, 'update this business'));
		} finally {
			saving = false;
		}
	}

	function askStatus(action: 'suspend' | 'activate') {
		confirmAction = action;
		confirmOpen = true;
	}

	async function runConfirm() {
		if (!business) return;
		confirmLoading = true;
		try {
			business = { ...business, ...(await setTenantStatus(business.id, confirmAction)) };
			toast.success(confirmAction === 'suspend' ? 'Business suspended' : 'Business activated');
			confirmOpen = false;
		} catch (err) {
			toast.error(errorMessage(err, `${confirmAction} this business`));
		} finally {
			confirmLoading = false;
		}
	}

	function openPlan() {
		planChoice = currentPlan.toUpperCase();
		planOpen = true;
	}

	async function savePlan() {
		if (!business || !planChoice) return;
		planSaving = true;
		try {
			business = { ...business, ...(await changeTenantPlan(business.id, planChoice)) };
			metrics = await fetchTenantMetrics(business.id);
			toast.success('Plan changed');
			planOpen = false;
		} catch (err) {
			toast.error(errorMessage(err, 'change the plan'));
		} finally {
			planSaving = false;
		}
	}

	async function resendInvite() {
		if (!business) return;
		inviteLoading = true;
		try {
			const r = await resendTenantInvite(business.id);
			inviteSetupUrl = r.setup_url;
			inviteNote = r.email_sent
				? `Emailed to ${r.admin_email}`
				: r.email_error
					? 'Email could not be sent. Copy the link and share it yourself.'
					: 'Email is not configured. Copy the link and share it yourself.';
			toast.success(r.email_sent ? 'Setup email sent' : 'New setup link generated');
		} catch (err) {
			toast.error(errorMessage(err, 'generate a setup link'));
		} finally {
			inviteLoading = false;
		}
	}

	async function copy(text: string, what: string) {
		try {
			await navigator.clipboard.writeText(text);
			toast.success(`${what} copied`);
		} catch {
			toast.error(`Could not copy the ${what.toLowerCase()}`);
		}
	}

	/** A subscription field, as a display string. */
	function subField(key: string): string {
		const v = subscription?.[key];
		return typeof v === 'string' && v ? v : '';
	}
</script>

{#if loading}
	<div style="display:flex;flex-direction:column;gap:1rem;">
		<div class="skeleton" style="height:3.5rem;width:22rem;"></div>
		<div class="stat-row">
			{#each [1, 2, 3, 4] as _, i (i)}<div class="skeleton" style="height:5.5rem;"></div>{/each}
		</div>
		<div class="skeleton" style="height:18rem;"></div>
	</div>
{:else if error}
	<div class="panel"><ErrorState message={error} onretry={load} /></div>
{:else if business}
	<header class="id-head">
		<div class="id-head-main">
			<TenantAvatar name={business.name} size="lg" />
			<div style="min-width:0;">
				<h1>{business.name}</h1>
				<div class="id-head-meta">
					<StatusBadge status={String(business.status)} />
					<span class="bt-type">{typeLabel}</span>
					{#if business.is_published}
						<StatusBadge status="PUBLISHED" dot={false} />
					{:else}
						<StatusBadge status="UNPUBLISHED" kind="neutral" dot={false} />
					{/if}
					{#if currentPlan}<StatusBadge status={currentPlan} kind="accent" dot={false} />{/if}
					<a class="mono store-link" href={storeUrl} target="_blank" rel="noopener">
						{storeUrl}
					</a>
					<button
						type="button"
						class="btn btn-quiet slug-copy"
						aria-label="Copy the store URL"
						onclick={() => copy(storeUrl, 'Store URL')}
					>
						<Copy size={11} strokeWidth={2} />
					</button>
				</div>
			</div>
		</div>

		<div class="id-head-actions">
			<a class="btn btn-ghost btn-sm" href={storeUrl} target="_blank" rel="noopener">
				<ExternalLink size={14} strokeWidth={2} />
				Open store
			</a>
			<button type="button" class="btn btn-ghost btn-sm" onclick={openEdit}>Edit</button>
			<Menu
				label="Business actions"
				items={[
					{ label: 'Change plan', onclick: openPlan },
					{ label: 'Manage users', onclick: () => setTab('users') },
					{ label: 'Copy store URL', onclick: () => copy(storeUrl, 'Store URL') },
					{ label: 'Regenerate setup link', onclick: resendInvite, separatorBefore: true },
					business.status === 'SUSPENDED'
						? { label: 'Activate business', onclick: () => askStatus('activate'), separatorBefore: true }
						: {
								label: 'Suspend business',
								danger: true,
								separatorBefore: true,
								onclick: () => askStatus('suspend')
							}
				]}
			/>
		</div>
	</header>

	<Tabs {tabs} bind:active={tab} onchange={setTab} />

	{#if business.setup_status === 'PENDING'}
		<div class="alert alert-warn" style="margin-bottom:1.1rem;flex-wrap:wrap;gap:0.75rem;">
			<Mail size={16} strokeWidth={1.9} />
			<div style="flex:1;min-width:14rem;">
				<strong style="color:var(--text);">Nobody can sign in yet</strong>
				<p style="margin:0.15rem 0 0;">
					The administrator has not set a password. Generate a fresh link if the last one expired.
				</p>
				{#if inviteNote}<p style="margin:0.35rem 0 0;font-size:var(--fs-tab);">{inviteNote}</p>{/if}
				{#if inviteSetupUrl}
					<div style="display:flex;align-items:center;gap:0.4rem;margin-top:0.5rem;">
						<code class="mono" style="flex:1;min-width:0;">{inviteSetupUrl}</code>
						<button
							type="button"
							class="btn btn-ghost btn-sm"
							aria-label="Copy the setup link"
							onclick={() => copy(inviteSetupUrl, 'Setup link')}
						>
							<Copy size={13} strokeWidth={2} />
						</button>
					</div>
				{/if}
			</div>
			<button
				type="button"
				class="btn btn-ghost btn-sm"
				disabled={inviteLoading}
				onclick={resendInvite}
			>
				<RefreshCw size={13} strokeWidth={2} class={inviteLoading ? 'spin' : ''} />
				{inviteLoading ? 'Generating…' : 'New setup link'}
			</button>
		</div>
	{/if}

	{#if tab === 'overview'}
		<StatGrid>
			<StatCard label="Orders today" value={metrics?.orders_today ?? '—'}>
				{#snippet icon()}<ReceiptText size={15} strokeWidth={1.9} />{/snippet}
			</StatCard>
			<StatCard label="Revenue today" value={metrics ? rupees(metrics.revenue_today) : '—'}>
				{#snippet icon()}<IndianRupee size={15} strokeWidth={1.9} />{/snippet}
			</StatCard>
			<StatCard
				label="Lifetime revenue"
				value={metrics ? rupees(metrics.revenue) : '—'}
				hint={aov ? `${rupees(aov)} average order` : undefined}
			>
				{#snippet icon()}<TrendingUp size={15} strokeWidth={1.9} />{/snippet}
			</StatCard>
			<StatCard
				label="Users"
				value={security?.users_total ?? '—'}
				hint={security ? `${security.users_active} active` : undefined}
			>
				{#snippet icon()}<Users size={15} strokeWidth={1.9} />{/snippet}
			</StatCard>
		</StatGrid>

		<div style="margin-bottom:0.85rem;">
			<LineChartPanel
				title="Orders — last 30 days"
				badge="This business"
				data={orderSeries}
				{loading}
			/>
		</div>

		<div class="grid-2" style="margin-bottom:0.85rem;">
			<SeriesBars
				title="Daily revenue"
				badge="Last 30 days"
				data={revenueSeries}
				{loading}
				formatValue={(n) => rupees(n)}
			/>
			<StatusBreakdown rows={metrics?.status_breakdown ?? []} {loading} />
		</div>

		<div class="grid-2">
			<section class="panel">
				<div class="bento-head">
					<h3 class="panel-h" style="margin:0;">Business information</h3>
					<button type="button" class="btn btn-ghost btn-sm" onclick={openEdit}>Edit</button>
				</div>
				<dl class="dl">
					<div><dt>Name</dt><dd>{business.name}</dd></div>
					<div><dt>Business type</dt><dd>{typeLabel}</dd></div>
					<div><dt>Subdomain</dt><dd class="mono">{business.slug}</dd></div>
					<div><dt>Owner</dt><dd>{business.owner_name || '—'}</dd></div>
					<div><dt>Email</dt><dd>{business.email || '—'}</dd></div>
					<div><dt>Phone</dt><dd>{business.phone || '—'}</dd></div>
					<div><dt>Address</dt><dd>{business.address || '—'}</dd></div>
					<div><dt>Onboarded</dt><dd>{formatDate(business.created_at)}</dd></div>
				</dl>
			</section>

			<section class="panel">
				<h3 class="panel-h">Trading</h3>
				<dl class="dl">
					<div><dt>Total orders</dt><dd>{metrics?.orders ?? '—'}</dd></div>
					<div><dt>Cancelled</dt><dd>{metrics?.cancelled_orders ?? '—'}</dd></div>
					<div>
						<dt>Completion rate</dt>
						<dd>{completionRate != null ? `${completionRate}%` : '—'}</dd>
					</div>
					<div>
						<dt>First order</dt>
						<dd>{metrics?.first_order_at ? formatDate(metrics.first_order_at) : 'None yet'}</dd>
					</div>
					<div>
						<dt>Most recent order</dt>
						<dd>{metrics?.last_order_at ? formatRelative(metrics.last_order_at) : '—'}</dd>
					</div>
					<div><dt>Storefront</dt><dd>{business.is_published ? 'Published' : 'Not published'}</dd></div>
				</dl>
			</section>
		</div>

		<div class="grid-2" style="margin-top:0.85rem;">
			<section class="panel">
				<h3 class="panel-h">
					<span style="display:flex;align-items:center;gap:0.45rem;">
						<ShieldCheck size={15} strokeWidth={1.9} />
						Access
					</span>
				</h3>
				<p class="panel-note" style="margin:0 0 0.85rem;">
					Who can sign in to this business. The people themselves are invited and managed by
					the business, on its own address — the console can only restore the owner's way in.
				</p>
				<dl class="dl">
					<div><dt>Users with access</dt><dd>{security?.users_total ?? '—'}</dd></div>
					<div><dt>Active</dt><dd>{security?.users_active ?? '—'}</dd></div>
					<div>
						<dt>Awaiting password setup</dt>
						<dd>
							{#if (security?.users_pending_password ?? 0) > 0}
								<span style="color:var(--warn);font-weight:600;">
									{security?.users_pending_password}
								</span>
							{:else}
								0
							{/if}
						</dd>
					</div>
					<div><dt>Active sessions</dt><dd>{security?.active_sessions ?? '—'}</dd></div>
				</dl>
			</section>

			<section class="panel">
				<h3 class="panel-h">
					<span style="display:flex;align-items:center;gap:0.45rem;">
						<Store size={15} strokeWidth={1.9} />
						The shop itself
					</span>
				</h3>
				<p class="panel-note" style="margin:0 0 0.85rem;">
					The console administers the business account: its details, its plan, and whether it
					may trade. It does not operate the shop.
				</p>
				<ul class="boundary">
					<li class="no">Theme, storefront and homepage</li>
					<li class="no">Menu, prices and availability</li>
					<li class="no">Opening hours, payments and order workflow</li>
					<li class="no">Store status and staff</li>
				</ul>
				<p class="field-hint" style="margin:0.75rem 0 0;">
					Those belong to {business.name} and are changed by its owner at
					<a class="mono" href={`${storeUrl.replace(/\/$/, '')}/shop`} target="_blank" rel="noopener">
						/shop
					</a>.
				</p>
			</section>
		</div>
	{:else if tab === 'subscription'}
		<div class="grid-2" style="margin-bottom:0.85rem;">
			<section class="panel">
				<div class="bento-head">
					<h3 class="panel-h" style="margin:0;">Current plan</h3>
					<button type="button" class="btn btn-ghost btn-sm" onclick={openPlan}>Change plan</button>
				</div>
				<dl class="dl">
					<div>
						<dt>Plan</dt>
						<dd>{planOption?.label ?? currentPlan ?? '—'}</dd>
					</div>
					<div>
						<dt>Price</dt>
						<dd>
							{planOption
								? planOption.price === 0
									? 'Free'
									: `₹${planOption.price.toLocaleString('en-IN')}`
								: '—'}
						</dd>
					</div>
					<div>
						<dt>Billing period</dt>
						<dd style="text-transform:capitalize;">
							{(planOption?.billingPeriod ?? '—').toString().replace('_', ' ')}
						</dd>
					</div>
					<div>
						<dt>Staff limit</dt>
						<dd>{planOption?.maxStaff ?? '—'}</dd>
					</div>
					<div>
						<dt>{terms.items} limit</dt>
						<dd>{planOption?.maxProducts ?? '—'}</dd>
					</div>
				</dl>
				{#if planOption && planOption.features.length > 0}
					<ul class="plan-features">
						{#each planOption.features as feature (feature)}
							<li>{feature}</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="panel">
				<h3 class="panel-h">Subscription</h3>
				{#if subscription}
					<dl class="dl">
						<div>
							<dt>Status</dt>
							<dd>
								<StatusBadge status={String(metrics?.subscription_status ?? subField('status'))} />
							</dd>
						</div>
						<div><dt>Started</dt><dd>{formatDate(subField('start_date'))}</dd></div>
						<div>
							<dt>{String(metrics?.subscription_status) === 'TRIAL' ? 'Trial ends' : 'Renews'}</dt>
							<dd>{formatDate(subField('end_at') || subField('renewal_date'))}</dd>
						</div>
						<div><dt>Plan on record</dt><dd>{subField('plan_name') || currentPlan}</dd></div>
					</dl>
					<p class="field-hint" style="margin:0.7rem 0 0;">
						No payment is taken by the platform. The subscription records what this business is
						provisioned for; changing the plan updates it immediately.
					</p>
				{:else}
					<EmptyState
						title="No subscription on record"
						description="This business has no subscription row. Changing its plan creates one."
					/>
				{/if}
			</section>
		</div>

		<section class="panel">
			<h3 class="panel-h">Usage against plan</h3>
			<dl class="dl" style="max-width:34rem;">
				<div>
					<dt>Staff accounts</dt>
					<dd>
						{security?.users_total ?? 0}{planOption?.maxStaff ? ` of ${planOption.maxStaff}` : ''}
					</dd>
				</div>
				<div><dt>Lifetime orders</dt><dd>{metrics?.orders ?? 0}</dd></div>
				<div><dt>Lifetime revenue</dt><dd>{metrics ? rupees(metrics.revenue) : '—'}</dd></div>
			</dl>
		</section>
	{:else if tab === 'configuration'}
		<section class="panel" style="margin-bottom:0.85rem;">
			<h3 class="panel-h">Business type</h3>
			<p class="panel-note">
				This business was set up as a <strong>{typeLabel}</strong>. The values below are what that
				template applied at onboarding — the owner can change any of them in their own storefront
				control, so treat these as the starting point rather than the live settings.
			</p>
			<dl class="dl" style="max-width:38rem;">
				<div><dt>Catalogue</dt><dd>{terms.catalog}, grouped into {terms.groups.toLowerCase()}</dd></div>
				<div><dt>Storefront theme</dt><dd style="text-transform:capitalize;">{template.storefront.theme_preset}</dd></div>
				<div><dt>Product layout</dt><dd style="text-transform:capitalize;">{template.storefront.product_layout}</dd></div>
				<div><dt>Order acceptance</dt><dd>{template.workflow.acceptance_mode === 'AUTO' ? 'Automatic' : 'Staff accept each order'}</dd></div>
				<div><dt>Payment timing</dt><dd>{template.workflow.payment_requirement === 'AT_PICKUP' ? 'At pickup' : 'Before preparation'}</dd></div>
				<div><dt>Preparation time</dt><dd>{template.behaviour.prep_time_minutes} min</dd></div>
			</dl>
			<p class="field-hint" style="margin:0.7rem 0 0;">
				The live storefront configuration belongs to the business and is edited by its owner at
				<a class="mono" href={`${storeUrl.replace(/\/$/, '')}/shop/customize`} target="_blank" rel="noopener">
					/shop/customize
				</a>.
			</p>
		</section>

		<div style="margin-bottom:0.85rem;">
			<TenantConfigAccessPanel tenantName={business.name} />
		</div>

	{:else if tab === 'activity'}
		{#if logs.length === 0}
			<div class="panel">
				<EmptyState
					title="No recorded activity"
					description="Events for this business — onboarding, status and plan changes, user lifecycle — appear here as they happen."
				/>
			</div>
		{:else}
			<section class="panel panel-flush">
				<div class="rows" style="padding:0 1.25rem;">
					{#each logs as ev (ev.id)}
						<div class="ev-row">
							<div style="min-width:0;">
								<strong style="font-size:var(--fs-body);font-weight:550;">
									{ev.action.replaceAll('_', ' ')}
								</strong>
								<p class="muted" style="margin:0.1rem 0 0;font-size:var(--fs-code);">
									{ev.actor || ev.actor_email || 'System'} · {ev.resource}
								</p>
							</div>
							<span class="muted" style="font-size:var(--fs-code);white-space:nowrap;">
								{formatDateTime(ev.timestamp)}
							</span>
						</div>
					{/each}
				</div>
			</section>
		{/if}
	{:else if tab === 'audit'}
		<section class="panel panel-flush">
			<div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border-subtle);">
				<p class="panel-note" style="margin:0 0 0.75rem;">
					Security-sensitive events only: who was created or disabled, what changed hands, and
					what was refused. Secrets are never recorded.
				</p>
				<div style="max-width:14rem;">
					<Select
						bind:value={auditResult}
						label="Result"
						id="audit-result"
						allLabel="Any result"
						options={[
							{ value: 'SUCCESS', label: 'Success' },
							{ value: 'FAILURE', label: 'Failure' },
							{ value: 'DENIED', label: 'Denied' }
						]}
					/>
				</div>
			</div>

			<DataTable
				loading={false}
				empty={auditLogs.length === 0}
				emptyTitle="No audit events"
				emptyDescription="Nothing security-sensitive has been recorded for this business."
			>
				{#snippet head()}
					<th>Event</th>
					<th>Actor</th>
					<th>Result</th>
					<th>When</th>
				{/snippet}
				{#each auditLogs as log (log.id)}
					<tr>
						<td>
							<strong style="font-weight:550;">{log.action.replaceAll('_', ' ')}</strong>
							<span class="muted" style="display:block;font-size:var(--fs-code);">{log.resource}</span>
						</td>
						<td>{log.actor || log.actor_email || 'System'}</td>
						<td><StatusBadge status={String(log.result)} /></td>
						<td class="muted" style="white-space:nowrap;" title={formatDateTime(log.timestamp)}>
							{formatRelative(log.timestamp)}
						</td>
					</tr>
				{/each}
			</DataTable>
		</section>
	{/if}
{/if}

<ConfirmDialog
	bind:open={confirmOpen}
	title={confirmAction === 'suspend' ? 'Suspend this business?' : 'Activate this business?'}
	message={business
		? confirmAction === 'suspend'
			? `Suspend ${business.name}? Its storefront stops serving customers and its staff cannot sign in until you reactivate it. Nothing is deleted.`
			: `Activate ${business.name}? Its storefront and console become reachable again immediately.`
		: ''}
	confirmLabel={confirmAction === 'suspend' ? 'Suspend business' : 'Activate business'}
	danger={confirmAction === 'suspend'}
	loading={confirmLoading}
	onconfirm={runConfirm}
/>

<Modal bind:open={planOpen} title="Change plan">
	<p class="muted" style="margin:0 0 0.9rem;font-size:var(--fs-body);line-height:1.5;">
		The business moves immediately and its subscription follows. Nothing is charged.
	</p>
	<PlanPicker {plans} bind:value={planChoice} />
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (planOpen = false)}>Cancel</button>
		<button
			type="button"
			class="btn btn-primary"
			disabled={planSaving || !planChoice || planChoice === currentPlan.toUpperCase()}
			onclick={savePlan}
		>
			{planSaving ? 'Moving…' : 'Change plan'}
		</button>
	{/snippet}
</Modal>

<SlideOver bind:open={editOpen} title="Edit business">
	<div style="display:flex;flex-direction:column;gap:0.85rem;">
		<FormField label="Business name" htmlFor="td-name" required>
			<TextInput id="td-name" bind:value={editForm.name} />
		</FormField>
		<FormField label="Owner" htmlFor="td-owner">
			<TextInput id="td-owner" bind:value={editForm.owner_name} />
		</FormField>
		<FormField
			label="Business type"
			htmlFor="td-type"
			hint="Changing the type does not rewrite a storefront the owner has already configured."
		>
			<SelectField
				id="td-type"
				bind:value={editForm.business_type}
				options={types
					.filter((t) => t.active || t.code === editForm.business_type)
					.map((t) => ({ value: t.code, label: t.label }))}
			/>
		</FormField>
		<FormField label="Phone" htmlFor="td-phone">
			<TextInput id="td-phone" type="tel" bind:value={editForm.phone} />
		</FormField>
		<FormField label="Email" htmlFor="td-email">
			<TextInput id="td-email" type="email" bind:value={editForm.email} />
		</FormField>
		<FormField label="Address" htmlFor="td-address">
			<TextArea id="td-address" bind:value={editForm.address} rows={2} />
		</FormField>
	</div>
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (editOpen = false)}>Cancel</button>
		<button
			type="button"
			class="btn btn-primary"
			disabled={saving || !editForm.name.trim()}
			onclick={saveEdit}
		>
			{saving ? 'Saving…' : 'Save changes'}
		</button>
	{/snippet}
</SlideOver>

<style>
	.bt-type {
		font-size: var(--fs-code);
		font-weight: 550;
		color: var(--text-3);
		padding: 0.1rem 0.45rem;
		border-radius: 999px;
		background: var(--surface-3);
	}

	.store-link {
		color: var(--text-3);
		text-decoration: none;
		/* The URL is the longest thing in the header; on a phone it truncates
		   rather than pushing the status badges off the row. */
		max-width: min(100%, 22rem);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.store-link:hover {
		color: var(--accent-dark);
		text-decoration: underline;
	}

	.boundary {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.4rem;
	}

	.boundary li {
		position: relative;
		padding-left: 1.4rem;
		font-size: var(--fs-body);
		line-height: 1.5;
		color: var(--text-3);
	}

	.boundary li::before {
		content: '—';
		position: absolute;
		left: 0.2rem;
		color: var(--text-3);
		font-weight: 700;
	}

	.ev-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.7rem 0;
	}

	.plan-features {
		margin: 0.85rem 0 0;
		padding-left: 1.05rem;
		display: grid;
		gap: 0.25rem;
	}

	.plan-features li {
		font-size: var(--fs-tab);
		color: var(--text-2);
	}
</style>
