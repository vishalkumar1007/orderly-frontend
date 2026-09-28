<script lang="ts">
	import { onMount } from 'svelte';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import ChefHat from '@lucide/svelte/icons/chef-hat';
	import QrCode from '@lucide/svelte/icons/qr-code';
	import Rocket from '@lucide/svelte/icons/rocket';
	import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
	import { api } from '$lib/api/client';
	import EmptyState from '$lib/components/admin/EmptyState.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import HourlyBarsChart from '$lib/components/admin/HourlyBarsChart.svelte';
	import MetricCard from '$lib/components/admin/MetricCard.svelte';
	import Reveal from '$lib/components/admin/Reveal.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import StatusDonut from '$lib/components/admin/StatusDonut.svelte';
	import TopProductsPanel from '$lib/components/admin/TopProductsPanel.svelte';
	import TrendAreaChart from '$lib/components/admin/TrendAreaChart.svelte';
	import { toast } from '$lib/components/admin/toast';
	import { formatCurrency } from '$lib/admin/format';
	import { orderBoard } from '$lib/tenant/orders.svelte';
	import type { SetupStepKey } from '$lib/tenant/dashboardCache.svelte';
	import {
		getDashboardSnapshot,
		loadDashboardSnapshot,
		setDashboardSnapshot,
		type DashboardSetup as Setup,
		type DashboardStats as Stats,
		type DashboardStoreLink as StoreLink
	} from '$lib/tenant/dashboardCache.svelte';
	import { quickActions, terms } from '$lib/tenant/businessType.svelte';

	const t = $derived(terms());

	/**
	 * Icons for the destinations a quick action can point at. Keyed by path so
	 * a type can reorder or reword its shortcuts in `businessTypes.ts` without
	 * touching this screen, and a path with no icon still renders.
	 */
	const ACTION_ICONS: Record<string, typeof ArrowRight> = {
		'/shop/orders': ClipboardList,
		'/shop/kitchen': ChefHat,
		'/shop/menu': UtensilsCrossed,
		'/shop/storefront/qr': QrCode
	};

	/**
	 * The dashboard's shortcuts, in the order this kind of business needs them:
	 * a cafe opens the counter first, a grocer the packing queue. The QR code is
	 * appended for everyone because sharing the store is not type-specific.
	 *
	 * Live counts are layered on top, so the card says "3 active" rather than
	 * repeating its own label.
	 */
	const quickLinks = $derived(
		[...quickActions(), { label: 'QR code', href: '/shop/storefront/qr' }].map((a) => ({
			...a,
			icon: ACTION_ICONS[a.href.split('?')[0]] ?? ArrowRight,
			hint: hintFor(a.href)
		}))
	);

	function hintFor(href: string): string {
		if (href.startsWith('/shop/orders')) {
			return orderBoard.activeCount > 0
				? `${orderBoard.activeCount} active`
				: `View the ${t.order.toLowerCase()} board`;
		}
		if (href.startsWith('/shop/kitchen')) return `Prep ${t.ticket.toLowerCase()}s`;
		if (href.startsWith('/shop/menu')) return `${t.items} & availability`;
		if (href.startsWith('/shop/storefront/qr')) return 'Share your store';
		return 'Open';
	}
	import {
		fetchTenantAnalytics,
		percentChange,
		type AnalyticsWindow,
		type TenantAnalytics
	} from '$lib/tenant/analytics';

	const STORE_STATUSES = [
		{ value: 'OPEN', label: 'Open' },
		{ value: 'BUSY', label: 'Busy' },
		{ value: 'AWAY', label: 'Away' },
		{ value: 'CLOSED', label: 'Closed' }
	] as const;

	const WINDOWS: { v: AnalyticsWindow; l: string }[] = [
		{ v: '7d', l: '7d' },
		{ v: '14d', l: '14d' },
		{ v: '30d', l: '30d' },
		{ v: '90d', l: '90d' }
	];

	/**
	 * The short form of the launch checklist. The full list, with its optional
	 * steps, lives on /shop/setup — this is the nudge, not the workspace, so it
	 * carries only what stands between the shop and its first order.
	 */
	const CHECKLIST: { key: SetupStepKey; label: string; href: string }[] = [
		{ key: 'business_info', label: 'Complete your business details', href: '/shop/settings?section=business' },
		{ key: 'menu', label: 'Add products to your menu', href: '/shop/menu' },
		{ key: 'payment', label: 'Confirm payment methods', href: '/shop/payments' },
		{ key: 'hours', label: 'Set your operating hours', href: '/shop/storefront/hours' },
		{ key: 'storefront', label: 'Set up your storefront', href: '/shop/customize' },
		{ key: 'launch', label: 'Publish your store', href: '/shop/setup' }
	];

	const seed = getDashboardSnapshot();
	let stats = $state<Stats | null>(seed?.stats ?? null);
	let store = $state<StoreLink | null>(seed?.store ?? null);
	let setup = $state<Setup | null>(seed?.setup ?? null);
	let error = $state('');
	/** Only block the pane when we have nothing to show yet. */
	let loading = $state(!seed);
	let publishing = $state(false);
	let analytics = $state<TenantAnalytics | null>(null);
	let analyticsLoading = $state(true);
	let window = $state<AnalyticsWindow>('30d');
	let currency = $state(seed?.currency ?? 'INR');

	const money = (n: number) => formatCurrency(Math.round(Number(n) || 0), currency);

	const statusLabel = (s: string) => STORE_STATUSES.find((x) => x.value === s)?.label ?? s;

	const doneCount = $derived(setup ? CHECKLIST.filter((c) => setup!.steps[c.key]).length : 0);
	const progress = $derived(Math.round((doneCount / CHECKLIST.length) * 100));
	const showSetup = $derived(Boolean(setup && !setup.is_published));

	/** Period totals from the selected window's daily series. */
	const periodRevenue = $derived(
		analytics?.orders_by_day.reduce((s, d) => s + Number(d.revenue || 0), 0) ?? 0
	);
	const periodOrders = $derived(
		analytics?.orders_by_day.reduce((s, d) => s + Number(d.order_count || 0), 0) ?? 0
	);
	const periodAvg = $derived(periodOrders > 0 ? periodRevenue / periodOrders : 0);
	const periodLabel = $derived(
		({ '7d': '7 days', '14d': '14 days', '30d': '30 days', '90d': '90 days' } as const)[window]
	);

	/** Minutes read as a duration, or a dash when nothing has been measured. */
	function minutesLabel(value: number | undefined): string {
		if (!value || value <= 0) return '—';
		if (value < 1) return 'under a minute';
		if (value < 60) return `${Math.round(value)} min`;
		const hours = Math.floor(value / 60);
		const minutes = Math.round(value % 60);
		return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
	}

	const prepLabel = $derived(minutesLabel(analytics?.median_prep_minutes));
	const acceptLabel = $derived(minutesLabel(analytics?.avg_accept_minutes));

	/** Human label for a payment method, including the unrecorded case. */
	function payLabel(method: string): string {
		switch (method) {
			case 'ONLINE':
				return 'Online payment';
			case 'CASH':
				return 'Cash';
			case 'UNRECORDED':
				return 'No payment recorded';
			default:
				return method.charAt(0) + method.slice(1).toLowerCase();
		}
	}


	/** Compare first half vs second half of the selected window. */
	const periodTrend = $derived.by(() => {
		const days = analytics?.orders_by_day ?? [];
		if (days.length < 4) return null;
		const mid = Math.floor(days.length / 2);
		const prev = days.slice(0, mid).reduce((s, d) => s + Number(d.revenue || 0), 0);
		const curr = days.slice(mid).reduce((s, d) => s + Number(d.revenue || 0), 0);
		return percentChange(curr, prev);
	});

	const orderTrend = $derived.by(() => {
		const days = analytics?.orders_by_day ?? [];
		if (days.length < 4) return null;
		const mid = Math.floor(days.length / 2);
		const prev = days.slice(0, mid).reduce((s, d) => s + Number(d.order_count || 0), 0);
		const curr = days.slice(mid).reduce((s, d) => s + Number(d.order_count || 0), 0);
		return percentChange(curr, prev);
	});

	const revenueSeries = $derived(analytics?.orders_by_day.map((d) => Number(d.revenue || 0)) ?? []);
	const orderSeries = $derived(analytics?.orders_by_day.map((d) => Number(d.order_count || 0)) ?? []);

	const storefrontUrl = $derived(
		store ? `http://${store.public_host}${store.public_path}` : ''
	);

	async function loadAnalytics(target: AnalyticsWindow) {
		analyticsLoading = true;
		try {
			analytics = await fetchTenantAnalytics(target);
		} catch {
			analytics = null;
		} finally {
			analyticsLoading = false;
		}
	}

	onMount(() => {
		let cancelled = false;
		void loadAnalytics(window);
		(async () => {
			try {
				// Cache hit → paint immediately, then refresh in the background.
				const snap = await loadDashboardSnapshot(Boolean(getDashboardSnapshot()));
				if (cancelled) return;
				stats = snap.stats;
				store = snap.store;
				setup = snap.setup;
				currency = snap.currency;
			} catch (err) {
				if (!cancelled && !stats) error = err instanceof Error ? err.message : 'Failed to load';
			} finally {
				if (!cancelled) loading = false;
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	function syncDashboardCache() {
		if (!stats || !store || !setup) return;
		setDashboardSnapshot({ stats, store, setup, currency });
	}

	async function togglePublish() {
		if (!store || publishing) return;
		publishing = true;
		try {
			const path = store.is_published ? '/api/v1/tenant/unpublish' : '/api/v1/tenant/publish';
			const res = await api<StoreLink>(path, { method: 'POST' });
			store = { ...store, ...res };
			syncDashboardCache();
			toast.success(store.is_published ? 'Your store is live' : 'Store unpublished');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not change publish state');
		} finally {
			publishing = false;
		}
	}

	async function setStoreStatus(status: string) {
		if (!store || status === store.store_status) return;
		try {
			const res = await api<{ store_status?: string }>('/api/v1/tenant/storefront', {
				method: 'PUT',
				body: JSON.stringify({ store_status: status })
			});
			store = { ...store, store_status: res.store_status ?? status };
			syncDashboardCache();
			toast.success(`Store is now ${statusLabel(status)}`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not update store status');
		}
	}
</script>

{#if error}
	<ErrorState message={error} onretry={() => location.reload()} />
{/if}

<div class="dash">
	<!-- Hero: identity + live controls -->
	{#if store}
		<section class="dash-hero panel">
			<div class="dash-hero-left">
				<div class="dash-hero-badges">
					<span class={['dash-chip', store.is_published ? 'live' : 'off'].join(' ')}>
						{#if store.is_published}
							<span class="dash-dot"></span> Live
						{:else}
							Draft
						{/if}
					</span>
					<span class="dash-chip muted">{statusLabel(store.store_status)}</span>
				</div>
				<h1 class="dash-title">{store.name}</h1>
				{#if storefrontUrl}
					<a class="dash-url" href={storefrontUrl} target="_blank" rel="noreferrer">
						{storefrontUrl.replace(/^https?:\/\//, '')}
						<ExternalLink size={12} strokeWidth={2} />
					</a>
				{/if}
			</div>
			<div class="dash-hero-right">
				<div class="dash-status-row" role="group" aria-label="Store status">
					{#each STORE_STATUSES as s (s.value)}
						<button
							type="button"
							class="dash-status"
							class:active={store.store_status === s.value}
							onclick={() => setStoreStatus(s.value)}
						>
							{s.label}
						</button>
					{/each}
				</div>
				<button
					class={['btn', 'btn-sm', store.is_published ? 'btn-ghost' : 'btn-primary'].join(' ')}
					type="button"
					disabled={publishing}
					onclick={togglePublish}
				>
					{#if store.is_published}
						<EyeOff size={14} strokeWidth={2} /> Unpublish
					{:else}
						<Eye size={14} strokeWidth={2} /> Publish
					{/if}
				</button>
			</div>
		</section>
	{:else if loading}
		<section class="panel" style="padding:1.25rem;">
			<Skeleton height="4rem" />
		</section>
	{/if}

	<!-- Today -->
	<section class="dash-section">
		<div class="dash-section-head">
			<h2>Today</h2>
			<p>What needs attention right now</p>
		</div>
		{#if loading}
			<div class="dash-today">
				{#each [1, 2, 3, 4] as _, i (i)}
					<div class="dash-stat"><Skeleton height="2.4rem" /></div>
				{/each}
			</div>
		{:else if stats}
			<div class="dash-today">
				<div class="dash-stat accent">
					<span class="dash-stat-label">{t.orders}</span>
					<strong class="dash-stat-value">{stats.orders_today}</strong>
					<span class="dash-stat-hint">{stats.completed_today} completed</span>
				</div>
				<div class="dash-stat">
					<span class="dash-stat-label">Revenue</span>
					<strong class="dash-stat-value">{money(Number(stats.revenue_today))}</strong>
					<span class="dash-stat-hint">today</span>
				</div>
				<a class="dash-stat" class:hot={stats.pending_orders > 0} href="/shop/orders">
					<span class="dash-stat-label">Needs action</span>
					<strong class="dash-stat-value">{stats.pending_orders}</strong>
					<span class="dash-stat-hint">new {t.orders.toLowerCase()} →</span>
				</a>
				<a class="dash-stat" href="/shop/kitchen">
					<span class="dash-stat-label">In {t.station.toLowerCase()}</span>
					<strong class="dash-stat-value">{stats.preparing_orders + stats.ready_orders}</strong>
					<span class="dash-stat-hint">{stats.ready_orders} ready →</span>
				</a>
			</div>
		{/if}
	</section>

	<!-- Quick actions -->
	<section class="dash-section">
		<div class="dash-section-head">
			<h2>Quick actions</h2>
			<p>Jump to the work that matters</p>
		</div>
		<div class="dash-actions">
			{#each quickLinks as action (action.href)}
				{@const Icon = action.icon}
				<a class="dash-action" href={action.href}>
					<span class="dash-action-icon">
						<Icon size={18} strokeWidth={1.85} />
					</span>
					<span class="dash-action-body">
						<strong>{action.label}</strong>
						<span>{action.hint}</span>
					</span>
					<ArrowRight size={14} strokeWidth={2} />
				</a>
			{/each}
		</div>
	</section>

	<!-- Setup (only when unpublished) -->
	{#if showSetup && setup}
		<section class="panel dash-setup">
			<div class="dash-setup-head">
				<div>
					<h2>Finish setup</h2>
					<p>{doneCount} of {CHECKLIST.length} done · {progress}%</p>
				</div>
				{#if setup.steps.menu}
					<a class="btn btn-primary btn-sm" href="/shop/setup">
						<Rocket size={14} strokeWidth={2} /> Go live
					</a>
				{/if}
			</div>
			<div
				class="dash-progress"
				role="progressbar"
				aria-valuenow={progress}
				aria-valuemin="0"
				aria-valuemax="100"
			>
				<span style={`width:${progress}%`}></span>
			</div>
			<ul class="dash-checklist">
				{#each CHECKLIST as c (c.key)}
					{@const isDone = setup!.steps[c.key]}
					<li>
						<a class={['dash-check', isDone ? 'done' : ''].join(' ')} href={c.href}>
							<span class="dash-check-box">
								{#if isDone}<CircleCheck size={15} strokeWidth={2.2} />{/if}
							</span>
							<span>{c.label}</span>
							<ArrowRight size={14} strokeWidth={1.9} />
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- Performance -->
	<section class="dash-section">
		<div class="dash-section-head row">
			<div>
				<h2>Performance</h2>
				<p>Revenue and orders over the last {periodLabel}</p>
			</div>
			<div class="dash-windows" role="tablist" aria-label="Time range">
				{#each WINDOWS as opt (opt.v)}
					<button
						type="button"
						role="tab"
						aria-selected={window === opt.v}
						class:active={window === opt.v}
						onclick={() => {
							window = opt.v;
							void loadAnalytics(opt.v);
						}}
					>
						{opt.l}
					</button>
				{/each}
			</div>
		</div>

		<div class="dash-metrics">
			<MetricCard
				label={`Revenue · ${periodLabel}`}
				value={analyticsLoading ? '—' : money(periodRevenue)}
				hint="Selected period"
				loading={analyticsLoading}
				trend={periodTrend}
				series={revenueSeries}
			/>
			<MetricCard
				label={`Orders · ${periodLabel}`}
				value={analyticsLoading ? '—' : periodOrders}
				hint="Selected period"
				loading={analyticsLoading}
				trend={orderTrend}
				series={orderSeries}
			/>
			<MetricCard
				label="Average order"
				value={analyticsLoading ? '—' : money(periodAvg)}
				hint={`Across ${periodLabel}`}
				loading={analyticsLoading}
			/>
			<MetricCard
				label="Menu health"
				value={analyticsLoading
					? '—'
					: `${analytics?.products_available ?? 0} live`}
				hint={`${analytics?.products_unavailable ?? 0} unavailable`}
				loading={analyticsLoading}
			/>
		</div>

		<div class="dash-metrics">
			<MetricCard
				label="Typical prep time"
				value={analyticsLoading ? '—' : prepLabel}
				hint={analytics && analytics.avg_prep_minutes > 0
					? `${analytics.avg_prep_minutes} min on average`
					: 'From accepted to ready'}
				loading={analyticsLoading}
			/>
			<MetricCard
				label="Time to accept"
				value={analyticsLoading ? '—' : acceptLabel}
				hint="How long orders wait before you accept them"
				loading={analyticsLoading}
			/>
			<MetricCard
				label="Completion rate"
				value={analyticsLoading ? '—' : `${analytics?.completion_rate ?? 0}%`}
				hint={`Across ${periodLabel}`}
				loading={analyticsLoading}
			/>
			<MetricCard
				label="Cancellations"
				value={analyticsLoading ? '—' : `${analytics?.cancellation_rate ?? 0}%`}
				hint={analytics && analytics.cancelled_today > 0
					? `${analytics.cancelled_today} today`
					: 'None today'}
				loading={analyticsLoading}
			/>
		</div>

		<TrendAreaChart
			title="Trend"
			data={analytics?.orders_by_day ?? []}
			loading={analyticsLoading}
			formatValue={money}
		/>

		<div class="dash-charts">
			<StatusDonut data={analytics?.status_breakdown ?? []} loading={analyticsLoading} />
			<HourlyBarsChart data={analytics?.orders_by_hour ?? []} loading={analyticsLoading} />
		</div>

		<div class="dash-charts">
			<TopProductsPanel
				data={analytics?.top_products ?? []}
				loading={analyticsLoading}
				formatMoney={money}
			/>
			<TopProductsPanel
				title="Best categories"
				emptyLabel="No category sales in this period yet"
				data={analytics?.top_categories ?? []}
				loading={analyticsLoading}
				formatMoney={money}
			/>
		</div>

		<section class="panel pay-mix">
			<div class="bento-head">
				<h3 class="panel-h" style="margin:0;">How customers paid</h3>
				<span class="bento-pill">{periodLabel}</span>
			</div>
			{#if analyticsLoading}
				<Skeleton height="6rem" />
			{:else if (analytics?.payment_mix ?? []).length === 0}
				<p class="muted" style="font-size:0.82rem;margin:0;">
					No completed orders in this period yet.
				</p>
			{:else}
				<ul class="pay-rows">
					{#each analytics?.payment_mix ?? [] as row (row.method + row.status)}
						<li>
							<div class="pay-top">
								<strong>{payLabel(row.method)}</strong>
								<span class="muted">
									{row.order_count} order{row.order_count === 1 ? '' : 's'} · {money(row.revenue)}
								</span>
							</div>
							<div class="pay-bar" aria-hidden="true">
								<i style={`width:${Math.max(row.share, 2)}%;`}></i>
							</div>
							<span class="pay-share">{row.share}%</span>
						</li>
					{/each}
				</ul>
				<p class="field-hint" style="margin:0.75rem 0 0;">
					Payment methods are set under
					<a href="/shop/payments">Payments</a>.
				</p>
			{/if}
		</section>
	</section>

	{#if !loading && stats && stats.orders_today === 0 && store?.is_published}
		<Reveal class="panel">
			<EmptyState
				title="No orders yet today"
				description="Share your store link or QR code — new orders will show up here."
			>
				{#snippet action()}
					<a class="btn btn-primary" href="/shop/storefront/qr">Open QR code</a>
				{/snippet}
			</EmptyState>
		</Reveal>
	{/if}
</div>

<style>
	.pay-mix {
		margin-top: 0.85rem;
	}

	.pay-rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.75rem;
	}

	.pay-rows li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 3rem;
		grid-template-areas: 'top share' 'bar share';
		align-items: center;
		gap: 0.3rem 0.75rem;
	}

	.pay-top {
		grid-area: top;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		font-size: 0.82rem;
	}

	.pay-top strong {
		font-weight: 600;
	}

	.pay-top .muted {
		font-size: 0.75rem;
	}

	.pay-bar {
		grid-area: bar;
		height: 0.4rem;
		border-radius: 999px;
		background: var(--surface-3);
		overflow: hidden;
	}

	.pay-bar i {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, var(--accent), var(--accent-2));
	}

	.pay-share {
		grid-area: share;
		text-align: right;
		font-size: 0.8rem;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
		color: var(--text-2);
	}

	.dash {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		width: 100%;
		max-width: 100%;
		min-width: 0;
	}

	.dash-hero {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.1rem 1.15rem;
		/* A whisper, not a wash. `--accent-soft` here tinted the whole hero card
		   in the brand colour, which is most of what made a saturated theme
		   read as "the UI went dark". */
		background:
			radial-gradient(120% 140% at 100% 0%, color-mix(in srgb, var(--accent) 5%, transparent) 0%, transparent 55%),
			var(--surface);
	}

	.dash-hero-left {
		min-width: 0;
	}

	.dash-hero-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 0.45rem;
	}

	.dash-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 650;
		border: 1px solid var(--border);
		background: var(--surface-2);
		color: var(--text-2);
	}

	.dash-chip.live {
		background: color-mix(in srgb, var(--success) 12%, var(--surface));
		border-color: color-mix(in srgb, var(--success) 35%, var(--border));
		color: var(--success);
	}

	.dash-chip.off {
		color: var(--text-3);
	}

	.dash-chip.muted {
		font-weight: 550;
	}

	.dash-dot {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 999px;
		background: currentColor;
		box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 25%, transparent);
	}

	.dash-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1.2;
		overflow-wrap: anywhere;
	}

	.dash-url {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		margin-top: 0.35rem;
		font-size: 0.78rem;
		font-family: var(--font-mono);
		color: var(--accent-dark);
		text-decoration: none;
		word-break: break-all;
	}

	.dash-hero-right {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		align-items: stretch;
	}

	.dash-status-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.dash-status {
		padding: 0.35rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface);
		color: var(--text-2);
		font-size: 0.78rem;
		font-weight: 550;
		font-family: inherit;
		cursor: pointer;
		transition: background var(--tr), border-color var(--tr), color var(--tr);
	}

	.dash-status.active {
		background: var(--accent-soft);
		border-color: var(--accent);
		color: var(--accent-dark);
		font-weight: 650;
	}

	.dash-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}

	.dash-section-head h2 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 650;
		color: var(--text);
	}

	.dash-section-head p {
		margin: 0.15rem 0 0;
		font-size: 0.8rem;
		color: var(--text-3);
	}

	.dash-section-head.row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.dash-today {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.65rem;
	}

	.dash-stat {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
		padding: 0.85rem 0.9rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		text-decoration: none;
		color: inherit;
		transition: border-color var(--tr);
	}

	a.dash-stat:hover {
		border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
	}

	.dash-stat.accent .dash-stat-value {
		color: var(--icon-fg);
	}

	.dash-stat.hot {
		border-color: color-mix(in srgb, var(--warn) 45%, var(--border));
		background: color-mix(in srgb, var(--warn) 8%, var(--surface));
	}

	.dash-stat-label {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--text-3);
	}

	.dash-stat-value {
		font-family: var(--font-display);
		font-size: 1.4rem;
		font-weight: 750;
		letter-spacing: -0.02em;
		line-height: 1.15;
		font-variant-numeric: tabular-nums;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.dash-stat-hint {
		font-size: 0.7rem;
		color: var(--text-3);
	}

	.dash-actions {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.5rem;
	}

	.dash-action {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		min-height: 3.15rem;
		min-width: 0;
		padding: 0.6rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		color: var(--text-3);
		text-decoration: none;
		transition: border-color var(--tr);
	}

	.dash-action:hover {
		border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
	}

	.dash-action-icon {
		flex: none;
		width: 2.25rem;
		height: 2.25rem;
		display: grid;
		place-items: center;
		border-radius: 9px;
		background: var(--icon-bg);
		color: var(--icon-fg);
	}

	.dash-action-body {
		flex: 1;
		min-width: 0;
		line-height: 1.25;
	}

	.dash-action-body strong {
		display: block;
		font-size: 0.88rem;
		font-weight: 650;
		color: var(--text);
	}

	.dash-action-body span {
		display: block;
		font-size: 0.74rem;
		color: var(--text-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.dash-setup {
		padding: 1rem 1.1rem;
	}

	.dash-setup-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.7rem;
	}

	.dash-setup-head h2 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 650;
	}

	.dash-setup-head p {
		margin: 0.15rem 0 0;
		font-size: 0.8rem;
		color: var(--text-3);
	}

	.dash-progress {
		height: 0.4rem;
		border-radius: 999px;
		background: var(--surface-3);
		overflow: hidden;
		margin-bottom: 0.75rem;
	}

	.dash-progress span {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, var(--accent), var(--accent-2, var(--accent)));
	}

	.dash-checklist {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.dash-check {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-height: 2.5rem;
		padding: 0.35rem 0.4rem;
		border-radius: 10px;
		text-decoration: none;
		color: var(--text);
		font-size: 0.86rem;
		font-weight: 550;
	}

	.dash-check:hover {
		background: var(--surface-2);
	}

	.dash-check-box {
		flex: none;
		width: 1.3rem;
		height: 1.3rem;
		border-radius: 999px;
		border: 1.5px solid var(--border);
		display: grid;
		place-items: center;
		color: var(--success);
	}

	.dash-check.done {
		color: var(--text-2);
	}

	.dash-check.done .dash-check-box {
		border-color: color-mix(in srgb, var(--success) 45%, var(--border));
		background: var(--success-bg);
	}

	.dash-check :global(svg:last-child) {
		margin-left: auto;
		color: var(--text-3);
		flex: none;
	}

	.dash-windows {
		display: inline-flex;
		gap: 2px;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
	}

	.dash-windows button {
		padding: 0.35rem 0.65rem;
		border: 0;
		border-radius: calc(var(--radius-sm) - 2px);
		background: transparent;
		color: var(--text-3);
		font-size: 0.76rem;
		font-weight: 550;
		font-family: inherit;
		cursor: pointer;
	}

	.dash-windows button.active {
		background: var(--surface);
		color: var(--text);
		box-shadow: 0 1px 2px color-mix(in srgb, var(--text) 8%, transparent);
	}

	.dash-metrics {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.65rem;
	}

	.dash-charts {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.75rem;
	}

	@media (min-width: 700px) {
		.dash-hero {
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
		}

		.dash-hero-right {
			align-items: flex-end;
		}

		.dash-today {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}

		.dash-actions {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.dash-metrics {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}

		.dash-charts {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (min-width: 1100px) {
		.dash-actions {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
</style>
