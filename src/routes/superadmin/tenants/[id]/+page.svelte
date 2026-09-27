<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import {
		fetchAuditLogs,
		fetchTenant,
		fetchTenantMetrics,
		fetchTenantTypes,
		fetchThemePresets,
		resendTenantInvite,
		setTenantStatus,
		tenantPublicUrl,
		updateTenantLocal,
		updateTenantTheme
	} from '$lib/admin/api';
	import {
		businessTypeLabel,
		formatDate,
		formatDateTime,
		formatRelative,
		rupees,
		toNumber
	} from '$lib/admin/format';
	import type { AuditLog, Tenant, TenantMetrics, TenantType } from '$lib/admin/types';
	import type { ThemePreset } from '$lib/brandTheme';
	import Activity from '@lucide/svelte/icons/activity';
	import Copy from '@lucide/svelte/icons/copy';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import IndianRupee from '@lucide/svelte/icons/indian-rupee';
	import Mail from '@lucide/svelte/icons/mail';
	import ReceiptText from '@lucide/svelte/icons/receipt-text';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import BrandPicker from '$lib/components/admin/BrandPicker.svelte';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import EmptyState from '$lib/components/admin/EmptyState.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import LineChartPanel from '$lib/components/admin/LineChartPanel.svelte';
	import Menu from '$lib/components/admin/Menu.svelte';
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
	import TenantUsersPanel from '$lib/components/admin/TenantUsersPanel.svelte';
	import TextArea from '$lib/components/admin/TextArea.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';

	let tenant = $state<Tenant | null>(null);
	let metrics = $state<TenantMetrics | null>(null);
	let activityLogs = $state<AuditLog[]>([]);
	let loading = $state(true);
	let error = $state('');

	let tab = $state('overview');
	let confirmOpen = $state(false);
	let confirmAction = $state<'suspend' | 'activate'>('suspend');
	let confirmLoading = $state(false);
	let editOpen = $state(false);
	let saving = $state(false);
	let inviteSetupUrl = $state('');
	let inviteNote = $state('');
	let inviteLoading = $state(false);
	let presets = $state<ThemePreset[]>([]);
	let types = $state<TenantType[]>([]);
	let brandPreset = $state('indigo-violet');
	let brandMode = $state<'light' | 'dark' | 'system'>('system');
	let brandAccent = $state('');
	let editForm = $state({
		name: '',
		owner_name: '',
		phone: '',
		email: '',
		address: '',
		business_type: 'MOMO'
	});
	let storeStatus = $state('OPEN');
	let statusMessage = $state('');
	let storeStatusSaving = $state(false);

	const STORE_STATUSES = [
		{ value: 'OPEN', label: 'Open', color: '#16a34a' },
		{ value: 'BUSY', label: 'Busy', color: '#ea580c' },
		{ value: 'AWAY', label: 'Away', color: '#ca8a04' },
		{ value: 'CLOSED', label: 'Closed', color: '#dc2626' }
	];

	const id = $derived($page.params.id ?? '');

	const tabs = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'performance', label: 'Performance' },
		{ id: 'users', label: 'Users' },
		{ id: 'security', label: 'Security' },
		{ id: 'brand', label: 'Brand' },
		{ id: 'configuration', label: 'Configuration' },
		{ id: 'details', label: 'Details' },
		{ id: 'activity', label: 'Activity' }
	];

	async function load() {
		if (!id) return;
		loading = true;
		error = '';
		try {
			const [t, m, logs, p, ty] = await Promise.all([
				fetchTenant(id),
				fetchTenantMetrics(id),
				fetchAuditLogs(id),
				fetchThemePresets(),
				fetchTenantTypes()
			]);
			tenant = t;
			metrics = m;
			activityLogs = logs;
			presets = p;
			types = ty;
			brandPreset = t.theme?.preset_id || t.theme_preset_id || 'indigo-violet';
			brandMode = (t.theme?.color_mode as 'light' | 'dark' | 'system') || 'system';
			brandAccent =
				t.theme?.tokens?.accent &&
				t.theme.tokens.accent !== p.find((x) => x.id === brandPreset)?.tokens.accent
					? t.theme.tokens.accent
					: '';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load tenant';
			tenant = null;
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		const q = $page.url.searchParams.get('tab');
		if (q && tabs.some((t) => t.id === q)) tab = q;
		load();
	});

	function setTab(next: string) {
		tab = next;
		goto(`?tab=${next}`, { replaceState: true, keepFocus: true, noScroll: true });
	}

	/* ---------- derived chart data ---------- */
	const orderSeries = $derived(metrics?.orders_by_day ?? []);
	const revenueSeries = $derived(
		orderSeries.map((d) => ({
			label: d.day ? d.day.slice(5) : '',
			value: toNumber(d.revenue)
		}))
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

	/* ---------- actions ---------- */
	function openEdit() {
		if (!tenant) return;
		editForm = {
			name: tenant.name,
			owner_name: tenant.owner_name || '',
			phone: tenant.phone || '',
			email: tenant.email || '',
			address: tenant.address || '',
			business_type: tenant.business_type || 'MOMO'
		};
		editOpen = true;
	}

	async function saveEdit() {
		if (!tenant) return;
		saving = true;
		try {
			tenant = { ...tenant, ...(await updateTenantLocal(tenant.id, editForm)) };
			toast.success('Tenant updated');
			editOpen = false;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Update failed');
		} finally {
			saving = false;
		}
	}

	async function saveBrand() {
		if (!tenant) return;
		saving = true;
		try {
			tenant = {
				...tenant,
				...(await updateTenantTheme(tenant.id, {
					theme_preset_id: brandPreset,
					theme_color_mode: brandMode,
					theme_overrides: brandAccent.trim() ? { accent: brandAccent.trim() } : {}
				}))
			};
			toast.success('Brand updated');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Brand update failed');
		} finally {
			saving = false;
		}
	}

	function askStatus(action: 'suspend' | 'activate') {
		confirmAction = action;
		confirmOpen = true;
	}

	async function resendInvite() {
		if (!tenant) return;
		inviteLoading = true;
		try {
			const r = await resendTenantInvite(tenant.id);
			inviteSetupUrl = r.setup_url;
			inviteNote = r.email_sent
				? `Email sent to ${r.admin_email}`
				: r.email_error
					? `Email failed: ${r.email_error}`
					: 'SMTP is not configured. Copy the link and share it manually.';
			toast.success(r.email_sent ? 'Setup email sent' : 'New setup link generated');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Resend failed');
		} finally {
			inviteLoading = false;
		}
	}

	async function copy(text: string, what: string) {
		try {
			await navigator.clipboard.writeText(text);
			toast.success(`${what} copied`);
		} catch {
			toast.error('Copy failed');
		}
	}

	function copyStorefrontUrl() {
		if (tenant) copy(tenantPublicUrl(tenant), 'Storefront URL');
	}

	async function runConfirm() {
		if (!tenant) return;
		confirmLoading = true;
		try {
			tenant = { ...tenant, ...(await setTenantStatus(tenant.id, confirmAction)) };
			toast.success(confirmAction === 'suspend' ? 'Tenant suspended' : 'Tenant activated');
			confirmOpen = false;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Action failed');
		} finally {
			confirmLoading = false;
		}
	}

	async function saveStoreStatus() {
		if (!tenant) return;
		storeStatusSaving = true;
		try {
			tenant = {
				...tenant,
				...(await updateTenantLocal(tenant.id, {
					store_status: storeStatus,
					status_message: statusMessage
				}))
			};
			toast.success('Store status updated');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to update store status');
		} finally {
			storeStatusSaving = false;
		}
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
{:else if tenant}
	<header class="id-head">
		<div class="id-head-main">
			<TenantAvatar name={tenant.name} size="lg" />
			<div style="min-width:0;">
				<h1>{tenant.name}</h1>
				<div class="id-head-meta">
					<StatusBadge status={String(tenant.status)} />
					{#if tenant.setup_status}
						<StatusBadge status={String(tenant.setup_status)} />
					{/if}
					{#if tenant.is_published}
						<StatusBadge status="PUBLISHED" dot={false} />
					{/if}
					{#if tenant.plan}<StatusBadge status={String(tenant.plan)} kind="accent" />{/if}
					<span class="mono">{tenantPublicUrl(tenant)}</span>
				</div>
			</div>
		</div>

		<div class="id-head-actions">
			<a
				class="btn btn-ghost btn-sm"
				href={tenantPublicUrl(tenant)}
				target="_blank"
				rel="noopener"
			>
				<ExternalLink size={14} strokeWidth={2} />
				Storefront
			</a>
			<Menu
				label="Tenant actions"
				items={[
					{ label: 'Edit details', onclick: openEdit },
					{ label: 'Copy storefront URL', onclick: copyStorefrontUrl },
					{ label: 'Regenerate setup link', onclick: resendInvite },
					tenant.status === 'SUSPENDED'
						? { label: 'Activate tenant', onclick: () => askStatus('activate') }
						: { label: 'Suspend tenant', danger: true, onclick: () => askStatus('suspend') }
				]}
			/>
		</div>
	</header>

	<Tabs {tabs} bind:active={tab} onchange={setTab} />

	{#if tenant.setup_status === 'PENDING'}
		<div class="alert alert-warn" style="margin-bottom:1.1rem;flex-wrap:wrap;gap:0.75rem;">
			<Mail size={16} strokeWidth={1.9} />
			<div style="flex:1;min-width:14rem;">
				<strong style="color:var(--text);">Setup link not yet used</strong>
				<p style="margin:0.15rem 0 0;">
					The tenant administrator hasn't set a password. Generate a fresh link if the previous
					one expired.
				</p>
				{#if inviteNote}<p style="margin:0.35rem 0 0;font-size:0.78rem;">{inviteNote}</p>{/if}
				{#if inviteSetupUrl}
					<div style="display:flex;align-items:center;gap:0.4rem;margin-top:0.5rem;">
						<code class="mono" style="flex:1;min-width:0;">{inviteSetupUrl}</code>
						<button
							type="button"
							class="btn btn-ghost btn-sm"
							aria-label="Copy setup link"
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
				hint={aov ? `${rupees(aov)} avg order` : undefined}
			>
				{#snippet icon()}<TrendingUp size={15} strokeWidth={1.9} />{/snippet}
			</StatCard>
			<StatCard
				label="Total orders"
				value={metrics?.orders ?? '—'}
				hint={completionRate != null ? `${completionRate}% completed` : undefined}
			>
				{#snippet icon()}<ReceiptText size={15} strokeWidth={1.9} />{/snippet}
			</StatCard>
		</StatGrid>

		<div style="margin-bottom:0.85rem;">
			<LineChartPanel
				title="Orders — last 30 days"
				badge="All time series"
				data={orderSeries}
				{loading}
			/>
		</div>

		<div class="grid-2">
			<SeriesBars
				title="Daily revenue"
				badge="Last 30 days"
				data={revenueSeries}
				{loading}
				formatValue={(n) => rupees(n)}
			/>
			<StatusBreakdown rows={metrics?.status_breakdown ?? []} {loading} />
		</div>

		<section class="panel" style="margin-top:0.85rem;">
			<h3 class="panel-h">Store status</h3>
			<p class="panel-note" style="margin:0 0 0.85rem;">
				Control how customers see this store. Changes apply immediately to the storefront.
			</p>
			<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.85rem;">
				{#each STORE_STATUSES as s (s.value)}
					<button
						type="button"
						class="btn btn-sm"
						style="
							padding:0.4rem 0.8rem;
							border-radius:999px;
							border:1.5px solid {storeStatus === s.value ? s.color : 'var(--border)'};
							background: {storeStatus === s.value ? s.color : 'var(--surface)'};
							color: {storeStatus === s.value ? '#fff' : 'var(--text-2)'};
							font-weight:550;
							font-size:0.82rem;
							cursor:pointer;
						"
						onclick={() => {
							storeStatus = s.value;
						}}
					>
						{s.label}
					</button>
				{/each}
			</div>
			<div style="margin-bottom:0.85rem;">
				<TextInput
					bind:value={statusMessage}
					placeholder="Custom status message (optional, e.g. Back in 30 minutes)"
					maxlength={200}
				/>
			</div>
			<button
				type="button"
				class="btn btn-primary btn-sm"
				disabled={storeStatusSaving}
				onclick={saveStoreStatus}
			>
				{storeStatusSaving ? 'Saving…' : 'Save store status'}
			</button>
		</section>
	{:else if tab === 'performance'}
		<div class="grid-2" style="margin-bottom:0.85rem;">
			<StatCard label="Lifetime orders" value={metrics?.orders ?? '—'} />
			<StatCard label="Lifetime revenue" value={metrics ? rupees(metrics.revenue) : '—'} />
			<StatCard label="Average order value" value={aov ? rupees(aov) : '—'} />
			<StatCard label="Cancelled orders" value={metrics?.cancelled_orders ?? '—'} />
		</div>

		<div style="margin-bottom:0.85rem;">
			<LineChartPanel
				title="Orders — last 30 days"
				badge={orderSeries.length ? `${orderSeries.length} days with orders` : ''}
				data={orderSeries}
				{loading}
			/>
		</div>

		<div class="grid-2">
			<SeriesBars
				title="Daily revenue"
				data={revenueSeries}
				{loading}
				formatValue={(n) => rupees(n)}
			/>
			<StatusBreakdown rows={metrics?.status_breakdown ?? []} {loading} />
		</div>

		<section class="panel" style="margin-top:0.85rem;">
			<h3 class="panel-h">Trading window</h3>
			<dl class="dl" style="max-width:34rem;">
				<div>
					<dt>First order</dt>
					<dd>{metrics?.first_order_at ? formatDate(metrics.first_order_at) : 'No orders yet'}</dd>
				</div>
				<div>
					<dt>Most recent order</dt>
					<dd>{metrics?.last_order_at ? formatRelative(metrics.last_order_at) : '—'}</dd>
				</div>
				<div>
					<dt>Completion rate</dt>
					<dd>{completionRate != null ? `${completionRate}%` : '—'}</dd>
				</div>
				<div>
					<dt>Cancellation rate</dt>
					<dd>
						{metrics && metrics.orders > 0
							? `${Math.round((metrics.cancelled_orders / metrics.orders) * 100)}%`
							: '—'}
					</dd>
				</div>
			</dl>
		</section>
	{:else if tab === 'users'}
		<TenantUsersPanel />
	{:else if tab === 'security'}
		<div class="grid-2" style="margin-bottom:0.85rem;">
			<section class="panel">
				<h3 class="panel-h">
					<span style="display:flex;align-items:center;gap:0.45rem;">
						<ShieldCheck size={15} strokeWidth={1.9} />
						Access posture
					</span>
				</h3>
				<dl class="dl">
					<div>
						<dt>Users with access</dt>
						<dd>{security?.users_total ?? '—'}</dd>
					</div>
					<div>
						<dt>Active users</dt>
						<dd>{security?.users_active ?? '—'}</dd>
					</div>
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
					<div>
						<dt>Active sessions</dt>
						<dd>{security?.active_sessions ?? '—'}</dd>
					</div>
				</dl>
			</section>

			<section class="panel">
				<h3 class="panel-h">
					<span style="display:flex;align-items:center;gap:0.45rem;">
						<Activity size={15} strokeWidth={1.9} />
						Audit trail
					</span>
				</h3>
				<dl class="dl">
					<div><dt>Recorded events</dt><dd>{security?.audit_events ?? '—'}</dd></div>
					<div><dt>Last 7 days</dt><dd>{security?.audit_events_7d ?? '—'}</dd></div>
					<div>
						<dt>Authentication</dt>
						<dd>Recorded on the platform audit log</dd>
					</div>
				</dl>
				<p class="field-hint" style="margin:0.5rem 0 0;">
					Tenant creation, status and plan changes, user lifecycle, and every authentication
					attempt are recorded with a real outcome. Platform-level logins appear under
					<a href="/superadmin/activity" style="color:var(--accent-dark);">Activity</a>.
				</p>
			</section>
		</div>

		<section class="panel">
			<h3 class="panel-h">Tenant isolation</h3>
			<p class="panel-note">
				This shop is reachable only on its own subdomain. The API rejects any request whose token
				tenant doesn't match the host tenant.
			</p>
			<dl class="dl" style="max-width:34rem;">
				<div><dt>Storefront host</dt><dd class="mono">{tenantPublicUrl(tenant)}</dd></div>
				<div>
					<dt>Shop login</dt>
					<dd class="mono">{tenantPublicUrl(tenant).replace(/\/$/, '')}/login</dd>
				</div>
				<div><dt>Status</dt><dd><StatusBadge status={String(tenant.status)} /></dd></div>
				<div>
					<dt>Storefront visible</dt>
					<dd>{tenant.is_published ? 'Published' : 'Hidden until published'}</dd>
				</div>
			</dl>
		</section>
	{:else if tab === 'configuration'}
		<TenantConfigAccessPanel tenantName={tenant?.name ?? ''} />
	{:else if tab === 'brand'}
		<section class="panel" style="max-width:56rem;">
			<h3 class="panel-h">Brand theme</h3>
			<p class="panel-note">Applied to this tenant's public storefront and shop portal.</p>
			<BrandPicker
				{presets}
				bind:presetId={brandPreset}
				bind:colorMode={brandMode}
				bind:accent={brandAccent}
			/>
			<div style="margin-top:1.1rem;">
				<button type="button" class="btn btn-primary" disabled={saving} onclick={saveBrand}>
					{saving ? 'Saving…' : 'Save brand'}
				</button>
			</div>
		</section>
	{:else if tab === 'details'}
		<div class="grid-2">
			<section class="panel">
				<div class="bento-head">
					<h3 class="panel-h" style="margin:0;">Organisation</h3>
					<button type="button" class="btn btn-ghost btn-sm" onclick={openEdit}>Edit</button>
				</div>
				<dl class="dl">
					<div><dt>Business name</dt><dd>{tenant.name}</dd></div>
					<div><dt>Slug</dt><dd class="mono">{tenant.slug}</dd></div>
					<div><dt>Business type</dt><dd>{businessTypeLabel(tenant.business_type)}</dd></div>
					<div><dt>Owner</dt><dd>{tenant.owner_name || '—'}</dd></div>
					<div><dt>Email</dt><dd>{tenant.email || '—'}</dd></div>
					<div><dt>Phone</dt><dd>{tenant.phone || '—'}</dd></div>
					<div><dt>Address</dt><dd>{tenant.address || '—'}</dd></div>
				</dl>
			</section>

			<section class="panel">
				<h3 class="panel-h">Platform record</h3>
				<dl class="dl">
					<div><dt>Tenant ID</dt><dd class="mono">{tenant.id}</dd></div>
					<div><dt>Status</dt><dd><StatusBadge status={String(tenant.status)} /></dd></div>
					<div>
						<dt>Setup</dt>
						<dd><StatusBadge status={String(tenant.setup_status || 'PENDING')} /></dd>
					</div>
					<div><dt>Published</dt><dd>{tenant.is_published ? 'Yes' : 'No'}</dd></div>
					<div><dt>Plan</dt><dd>{tenant.plan || '—'}</dd></div>
					<div><dt>Subscription</dt><dd>{tenant.subscription?.status ?? '—'}</dd></div>
					<div><dt>Created</dt><dd>{formatDate(tenant.created_at)}</dd></div>
					<div><dt>Last updated</dt><dd>{formatRelative(tenant.updated_at)}</dd></div>
				</dl>
			</section>
		</div>

		<p class="field-hint" style="margin-top:0.85rem;">
			Passwords, invite tokens, and refresh tokens are never exposed through this API.
		</p>
	{:else if tab === 'activity'}
		{#if activityLogs.length === 0}
			<div class="panel">
				<EmptyState
					title="No recorded activity"
					description="Events for this tenant — creation, status changes, plan changes — appear here."
				/>
			</div>
		{:else}
			<section class="panel panel-flush">
				<div class="rows" style="padding:0 1.25rem;">
					{#each activityLogs as ev (ev.id)}
						<div
							style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0.5rem;padding:0.7rem 0;"
						>
							<div style="min-width:0;">
								<strong style="font-size:0.85rem;font-weight:550;">
									{ev.action.replaceAll('_', ' ')}
								</strong>
								<p class="muted" style="margin:0.1rem 0 0;font-size:0.75rem;">
									{ev.actor || ev.actor_email || 'System'} · {ev.resource}
								</p>
							</div>
							<span class="muted" style="font-size:0.75rem;white-space:nowrap;">
								{formatDateTime(ev.timestamp)}
							</span>
						</div>
					{/each}
				</div>
			</section>
		{/if}
	{/if}
{/if}

<ConfirmDialog
	bind:open={confirmOpen}
	title={confirmAction === 'suspend' ? 'Suspend tenant?' : 'Activate tenant?'}
	message={tenant
		? confirmAction === 'suspend'
			? `Suspend ${tenant.name}? Their storefront and shop become unreachable until you reactivate.`
			: `Activate ${tenant.name} and restore platform access?`
		: ''}
	confirmLabel={confirmAction === 'suspend' ? 'Suspend' : 'Activate'}
	danger={confirmAction === 'suspend'}
	loading={confirmLoading}
	onconfirm={runConfirm}
/>

<SlideOver bind:open={editOpen} title="Edit tenant">
	<div style="display:flex;flex-direction:column;gap:0.85rem;">
		<FormField label="Business name" htmlFor="td-name" required>
			<TextInput id="td-name" bind:value={editForm.name} />
		</FormField>
		<FormField label="Owner" htmlFor="td-owner">
			<TextInput id="td-owner" bind:value={editForm.owner_name} />
		</FormField>
		<FormField label="Business type" htmlFor="td-type">
			<SelectField
				id="td-type"
				bind:value={editForm.business_type}
				options={types
					.filter((t) => t.active || t.code === editForm.business_type)
					.map((t) => ({ value: t.code, label: t.label }))}
			/>
		</FormField>
		<FormField label="Phone" htmlFor="td-phone">
			<TextInput id="td-phone" bind:value={editForm.phone} />
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
