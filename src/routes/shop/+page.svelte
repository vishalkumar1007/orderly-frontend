<script lang="ts">
	import { ApiClientError } from '$lib/api/client';
	import { onMount } from 'svelte';
	import ArrowRight from '@tabler/icons-svelte/icons/arrow-right';
	import CircleCheck from '@tabler/icons-svelte/icons/circle-check';
	import ClipboardList from '@tabler/icons-svelte/icons/clipboard-list';
	import Copy from '@tabler/icons-svelte/icons/copy';
	import Check from '@tabler/icons-svelte/icons/check';
	import ExternalLink from '@tabler/icons-svelte/icons/external-link';
	import ChefHat from '@tabler/icons-svelte/icons/chef-hat';
	import QrCode from '@tabler/icons-svelte/icons/qrcode';
	import Rocket from '@tabler/icons-svelte/icons/rocket';
	import UtensilsCrossed from '@tabler/icons-svelte/icons/tools-kitchen-2';
	import { api } from '$lib/api/client';
	import EmptyState from '$lib/components/admin/EmptyState.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import CategoryShare from '$lib/components/admin/dashboard/CategoryShare.svelte';
	import MenuPerformance from '$lib/components/admin/dashboard/MenuPerformance.svelte';
	import PaymentMix from '$lib/components/admin/dashboard/PaymentMix.svelte';
	import PulseStrip, { type Pulse } from '$lib/components/admin/dashboard/PulseStrip.svelte';
	import RevenueOrdersChart from '$lib/components/admin/dashboard/RevenueOrdersChart.svelte';
	import SalesRhythm from '$lib/components/admin/dashboard/SalesRhythm.svelte';
	import ServiceQuality from '$lib/components/admin/dashboard/ServiceQuality.svelte';
	import Reveal from '$lib/components/admin/Reveal.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import { toast } from '$lib/components/admin/toast';
	import { formatCurrency } from '$lib/admin/format';
	import { orderBoard } from '$lib/tenant/orders.svelte';
	import type { SetupStepKey } from '$lib/tenant/dashboardCache.svelte';
	import { page } from '$app/stores';
	import { policyStore, type PolicySignature } from '$lib/tenant/policyStore';
	import BusinessPolicyModal from '$lib/components/tenant/BusinessPolicyModal.svelte';
	import {
		getDashboardSnapshot,
		loadDashboardSnapshot,
		resolveStorefrontUrl,
		setDashboardSnapshot,
		storefrontUrlDisplay,
		type DashboardSetup as Setup,
		type DashboardStats as Stats,
		type DashboardStoreLink as StoreLink
	} from '$lib/tenant/dashboardCache.svelte';
	import { STORE_STATUS_OPTIONS } from '$lib/storefront/admin';
	import { quickActions, terms, orderingEnabled } from '$lib/tenant/businessType.svelte';

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
		'/shop/marketing/kit': QrCode
	};

	/**
	 * The dashboard's shortcuts, in the order this kind of business needs them:
	 * a cafe opens the counter first, a grocer the packing queue. Publish & Marketing
	 * is appended for everyone because sharing the store is not type-specific.
	 *
	 * Live counts are layered on top, so the card says "3 active" rather than
	 * repeating its own label.
	 */
	const quickLinks = $derived(
		[
			...quickActions(),
			{ label: 'QR & marketing', href: '/shop/marketing/kit?asset=qr' }
		].map((a) => ({
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
		if (href.startsWith('/shop/marketing/kit')) return 'Share your store';
		return 'Open';
	}
	import {
		fetchTenantAnalytics,
		type DayPoint,
		type Granularity,
		percentChange,
		type AnalyticsWindow,
		type TenantAnalytics
	} from '$lib/tenant/analytics';

	const WINDOWS: { v: AnalyticsWindow; l: string }[] = [
		{ v: '7d', l: '7d' },
		{ v: '14d', l: '14d' },
		{ v: '30d', l: '30d' },
		{ v: '90d', l: '90d' }
	];

	/**
	 * The short form of the launch checklist. The full list, with its optional
	 * steps, lives on /shop/storefront/promote: this is the nudge, not the workspace, so it
	 * carries only what stands between the shop and its first order.
	 */
	const tenantSlug = $derived(($page.data.tenantSlug as string) || '');
	let policySignature = $state<PolicySignature | null>(null);
	let policySigned = $state(false);
	let showPolicyModal = $state(false);

	function syncPolicyFromStore() {
		const slug = tenantSlug;
		if (!slug) return;
		const next = policyStore.getSignature(slug);
		policySignature = next;
		policySigned = !!next?.signed;
	}

	onMount(() => {
		syncPolicyFromStore();
		return policyStore.subscribe(() => syncPolicyFromStore());
	});

	const CHECKLIST: { key: SetupStepKey | 'policy'; label: string; href: string }[] = [
		{ key: 'policy', label: 'Sign Orderly Business Policy', href: '#policy' },
		{ key: 'business_info', label: 'Complete your business details', href: '/shop/settings?section=business' },
		{ key: 'menu', label: 'Add products to your menu', href: '/shop/menu' },
		{ key: 'payment', label: 'Confirm payment methods', href: '/shop/payments' },
		{ key: 'hours', label: 'Set your operating hours', href: '/shop/storefront/actions?section=hours' },
		{ key: 'storefront', label: 'Set up your storefront', href: '/shop/customize' },
		{ key: 'launch', label: 'Publish your store', href: '/shop/storefront/promote' }
	];

	const seed = getDashboardSnapshot();
	let stats = $state<Stats | null>(seed?.stats ?? null);
	let store = $state<StoreLink | null>(seed?.store ?? null);
	let setup = $state<Setup | null>(seed?.setup ?? null);
	let error = $state('');
	/** Only block the pane when we have nothing to show yet. */
	let loading = $state(!seed);
	let analytics = $state<TenantAnalytics | null>(null);
	let analyticsLoading = $state(true);
	let window = $state<AnalyticsWindow>('30d');
	let currency = $state(seed?.currency ?? 'INR');

	const money = (n: number) => formatCurrency(Math.round(Number(n) || 0), currency);

	const statusLabel = (s: string) =>
		STORE_STATUS_OPTIONS.find((x) => x.value === s)?.label ?? s;

	const currentStatus = $derived(store?.store_status || 'OPEN');
	const currentStatusMeta = $derived(
		STORE_STATUS_OPTIONS.find((x) => x.value === currentStatus) ?? STORE_STATUS_OPTIONS[0]
	);
	const orderingOpen = $derived(
		store?.ordering_open ?? (currentStatus === 'OPEN' || currentStatus === 'BUSY')
	);

	const doneCount = $derived(
		(policySigned ? 1 : 0) + (setup ? CHECKLIST.filter((c) => c.key !== 'policy' && setup!.steps[c.key as SetupStepKey]).length : 0)
	);
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
	const periodDays = $derived(analytics?.days ?? Number(window.replace('d', '')) ?? 30);

	/**
	 * The window before this one. The API sends it day for day, so the chart can
	 * overlay it and the cards can quote a real change rather than a guess.
	 */
	const prevDaily = $derived(analytics?.orders_prev_by_day ?? []);
	const prevRevenue = $derived(
		prevDaily.reduce((s, d) => s + Number(d.revenue || 0), 0)
	);
	const prevOrders = $derived(
		prevDaily.reduce((s, d) => s + Number(d.order_count || 0), 0)
	);
	const prevAvg = $derived(prevOrders > 0 ? prevRevenue / prevOrders : 0);
	const compareLabel = $derived(`vs previous ${periodLabel}`);

	/**
	 * The API buckets the current window by week or month, but the previous
	 * window arrives as days. Slice those days along each current bucket's span
	 * so the comparison overlay lines up whatever grouping is selected.
	 */
	function bucketPrevious(daily: DayPoint[], period: DayPoint[], previous: DayPoint[]): DayPoint[] {
		if (period.length === 0 || previous.length !== daily.length) return previous;
		const starts = period.map((p) => daily.findIndex((d) => d.day === p.day));
		return period.map((p, i) => {
			const from = starts[i];
			const to = i + 1 < starts.length ? starts[i + 1] : daily.length;
			if (from < 0) return { day: p.day, order_count: 0, revenue: 0 };
			const slice = previous.slice(from, to);
			return {
				day: p.day,
				order_count: slice.reduce((s, d) => s + Number(d.order_count || 0), 0),
				revenue: slice.reduce((s, d) => s + Number(d.revenue || 0), 0)
			};
		});
	}

	const prevForChart = $derived(
		bucketPrevious(analytics?.orders_by_day ?? [], analytics?.orders_by_period ?? [], prevDaily)
	);

	/** A change needs a period to change from; a rise from zero is not 100%. */
	function delta(current: number, previous: number, label: string) {
		if (previous <= 0) return null;
		return { ...percentChange(current, previous), label };
	}

	const revenueSeries = $derived(analytics?.orders_by_day.map((d) => Number(d.revenue || 0)) ?? []);
	const orderSeries = $derived(analytics?.orders_by_day.map((d) => Number(d.order_count || 0)) ?? []);

	const revenueTrend = $derived(delta(periodRevenue, prevRevenue, compareLabel));
	const orderTrend = $derived(delta(periodOrders, prevOrders, compareLabel));
	const averageTrend = $derived(delta(periodAvg, prevAvg, compareLabel));

	const customersActive = $derived(analytics?.customers_active ?? 0);

	const pulse = $derived<Pulse[]>([
		{
			label: 'Revenue',
			value: money(periodRevenue),
			hint: `${money(periodRevenue / Math.max(periodDays, 1))} a day on average`,
			trend: revenueTrend,
			series: revenueSeries,
			lead: true
		},
		{
			label: 'Orders',
			value: periodOrders.toLocaleString('en-IN'),
			hint: `${(periodOrders / Math.max(periodDays, 1)).toFixed(1)} a day on average`,
			trend: orderTrend,
			series: orderSeries,
			spark: 'bars'
		},
		{
			label: 'Average order',
			value: money(periodAvg),
			hint: `Across ${periodOrders.toLocaleString('en-IN')} orders`,
			trend: averageTrend,
			// Days without orders have no average, so they are left out of the line.
			series:
				analytics?.orders_by_day
					.filter((d) => Number(d.order_count) > 0)
					.map((d) => Number(d.revenue || 0) / Number(d.order_count)) ?? []
		},
		{
			label: 'Customers',
			value: customersActive.toLocaleString('en-IN'),
			hint:
				customersActive > 0
					? analytics?.repeat_customer_rate != null
						? `${analytics.repeat_customer_rate}% order again`
						: 'No repeat orders yet'
					: `${analytics?.customers_total ?? 0} customers on the books`,
			split: [
				{ label: 'New', value: analytics?.customers_new ?? 0 },
				{ label: 'Returning', value: analytics?.customers_returning ?? 0 }
			]
		}
	]);

	const storefrontUrl = $derived(store ? resolveStorefrontUrl(store) : '');
	const storefrontHostLabel = $derived(storefrontUrl ? storefrontUrlDisplay(storefrontUrl) : '');
	let statusSaving = $state(false);
	let copiedLink = $state(false);

	async function copyStorefrontLink() {
		if (!storefrontUrl) return;
		try {
			await navigator.clipboard.writeText(storefrontUrl);
			copiedLink = true;
			toast.success('Link copied');
			setTimeout(() => (copiedLink = false), 2000);
		} catch {
			toast.error('Could not copy: select the link manually');
		}
	}

	/** Set when the plan does not include analytics: the API's own sentence. */
	let analyticsLocked = $state('');

	/** How the trend chart groups days. */
	let granularity = $state<Granularity>('day');

	/** Weeks need at least two of them to mean anything; months a full 30 days. */
	const granularityAllowed = $derived({
		week: window === '14d' || window === '30d' || window === '90d',
		month: window === '30d' || window === '90d'
	});

	/**
	 * `soft` keeps the current charts on screen while a re-grouped trend loads,
	 * so flipping Day/Week/Month does not blank the whole dashboard.
	 */
	async function loadAnalytics(target: AnalyticsWindow, soft = false) {
		if (!soft) analyticsLoading = true;
		analyticsLocked = '';
		try {
			analytics = await fetchTenantAnalytics(target, granularity);
		} catch (err) {
			analytics = null;
			if (err instanceof ApiClientError && err.code === 'feature_not_in_plan') {
				analyticsLocked = err.message;
			}
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

	async function setStoreStatus(status: string) {
		if (!store || statusSaving || status === currentStatus) return;
		statusSaving = true;
		const previous = store;
		// Optimistic: keep the hero chip and toggles in lockstep while the PUT is in flight.
		store = {
			...store,
			store_status: status,
			store_status_label: statusLabel(status),
			ordering_open: status === 'OPEN' || status === 'BUSY'
		};
		syncDashboardCache();
		try {
			const res = await api<{
				behaviour?: {
					store_status?: string;
					status_message?: string;
					store_status_label?: string;
				};
			}>('/api/v1/tenant/storefront', {
				method: 'PUT',
				body: JSON.stringify({ store_status: status })
			});
			const nextStatus = res.behaviour?.store_status ?? status;
			store = {
				...store,
				store_status: nextStatus,
				store_status_label:
					res.behaviour?.store_status_label ?? statusLabel(nextStatus),
				status_message:
					res.behaviour?.status_message ?? store.status_message ?? '',
				ordering_open: nextStatus === 'OPEN' || nextStatus === 'BUSY'
			};
			syncDashboardCache();
			toast.success(`Store is now ${statusLabel(nextStatus)}`);
		} catch (err) {
			store = previous;
			syncDashboardCache();
			toast.error(err instanceof Error ? err.message : 'Could not update store status');
		} finally {
			statusSaving = false;
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
					<span
						class={[
							'dash-chip',
							'ordering',
							orderingOpen ? 'ordering-open' : 'ordering-closed'
						].join(' ')}
					>
						{orderingOpen ? 'Accepting orders' : 'Not accepting'}
					</span>
					<span
						class={['dash-chip', 'status', `status-${currentStatus.toLowerCase()}`].join(' ')}
						title={currentStatusMeta.desc}
					>
						<span class="dash-dot"></span>
						{store.store_status_label || currentStatusMeta.label}
					</span>
				</div>
				<h1 class="dash-title">{store.name}</h1>
				{#if storefrontUrl}
					<div class="dash-link-bar">
						<a
							class="dash-link-url"
							href={storefrontUrl}
							target="_blank"
							rel="noreferrer"
							title={storefrontUrl}
						>
							{storefrontHostLabel}
						</a>
						<div class="dash-link-actions">
							<button
								type="button"
								class="dash-link-btn"
								onclick={copyStorefrontLink}
								aria-label="Copy storefront link"
							>
								{#if copiedLink}
									<Check size={14} stroke={1.6} />
									<span>Copied</span>
								{:else}
									<Copy size={14} stroke={1.6} />
									<span>Copy</span>
								{/if}
							</button>
							<a
								class="dash-link-btn"
								href={storefrontUrl}
								target="_blank"
								rel="noreferrer"
								aria-label="Open storefront"
							>
								<ExternalLink size={14} stroke={1.6} />
								<span>Open</span>
							</a>
							<a
								class="dash-link-btn"
								href="/shop/marketing/kit?asset=qr"
								aria-label="QR code and marketing"
							>
								<QrCode size={14} stroke={1.6} />
								<span>QR</span>
							</a>
						</div>
					</div>
					{#if !store.is_published}
						<p class="dash-link-hint">Draft: not public yet. Publish when you’re ready.</p>
					{/if}
				{/if}
			</div>
			<div class="dash-hero-right">
				<p class="dash-status-hint">Store status</p>
				<div class="dash-status-row" role="group" aria-label="Store status">
					{#each STORE_STATUS_OPTIONS as s (s.value)}
						<button
							type="button"
							class={['dash-status', `status-${s.value.toLowerCase()}`].join(' ')}
							class:active={currentStatus === s.value}
							disabled={statusSaving}
							aria-pressed={currentStatus === s.value}
							title={s.desc}
							onclick={() => setStoreStatus(s.value)}
						>
							{s.label}
						</button>
					{/each}
				</div>
			</div>
		</section>
	{:else if loading}
		<section class="panel" style="padding:1.25rem;">
			<Skeleton height="4rem" />
		</section>
	{/if}

	<!-- Today -->
	{#if orderingEnabled()}
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
	{/if}

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
						<Icon size={18} stroke={1.6} />
					</span>
					<span class="dash-action-body">
						<strong>{action.label}</strong>
						<span>{action.hint}</span>
					</span>
					<ArrowRight size={14} stroke={1.6} />
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
					<a class="btn btn-primary btn-sm" href="/shop/storefront/promote">
						<Rocket size={14} stroke={1.6} /> Go live
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
					{@const isDone = c.key === 'policy' ? policySigned : (setup ? setup.steps[c.key as SetupStepKey] : false)}
					<li>
						<a
							class={['dash-check', isDone ? 'done' : ''].join(' ')}
							href={c.href}
							onclick={(e) => {
								if (c.key === 'policy') {
									e.preventDefault();
									showPolicyModal = true;
								} else if (!policySigned) {
									e.preventDefault();
									toast.info('Please sign the Orderly Business Policy first to unlock setup.');
									showPolicyModal = true;
								}
							}}
						>
							<span class="dash-check-box">
								{#if isDone}<CircleCheck size={15} stroke={1.6} />{/if}
							</span>
							<span>{c.label}</span>
							<ArrowRight size={14} stroke={1.6} />
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- Performance -->
	{#if !orderingEnabled()}
		<section class="dash-section">
			<div class="dash-section-head">
				<h2>Performance</h2>
				<p>Order analytics aren't tracked for this business type yet.</p>
			</div>
		</section>
	{:else if analyticsLocked}
		<section class="dash-section">
			<div class="dash-section-head">
				<h2>Performance</h2>
				<p>{analyticsLocked} Ask your platform administrator to change your plan.</p>
			</div>
		</section>
	{:else}
	<section class="dash-section perf">
		<div class="dash-section-head row">
			<div>
				<h2>Performance</h2>
				<p>Last {periodLabel}, compared with the {periodLabel} before</p>
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
							// A grouping the new window cannot fill falls back to days.
							if (
								(granularity === 'week' && !granularityAllowed.week) ||
								(granularity === 'month' && !granularityAllowed.month)
							) {
								granularity = 'day';
							}
							void loadAnalytics(opt.v);
						}}
					>
						{opt.l}
					</button>
				{/each}
			</div>
		</div>

		<PulseStrip items={pulse} loading={analyticsLoading} />

		<div class="dash-charts main">
			<RevenueOrdersChart
				data={analytics?.orders_by_period ?? analytics?.orders_by_day ?? []}
				previous={prevForChart}
				loading={analyticsLoading}
				formatValue={money}
				{granularity}
				allowed={granularityAllowed}
				ongranularity={(g) => {
					if (g === granularity) return;
					granularity = g;
					void loadAnalytics(window, true);
				}}
			/>

			<ServiceQuality
				medianPrep={analytics?.median_prep_minutes ?? 0}
				avgPrep={analytics?.avg_prep_minutes ?? 0}
				avgAccept={analytics?.avg_accept_minutes ?? 0}
				fulfilment={analytics?.fulfilment_rate ?? null}
				cancellationRate={analytics?.cancellation_rate ?? 0}
				completed={analytics?.completed_orders ?? 0}
				cancelled={analytics?.cancelled_orders ?? 0}
				loading={analyticsLoading}
			/>
		</div>

		<div class="dash-charts main">
			<SalesRhythm
				data={analytics?.orders_by_hour ?? []}
				grid={analytics?.orders_by_weekday_hour ?? []}
				days={analytics?.days ?? 30}
				loading={analyticsLoading}
				formatValue={money}
			/>

			<PaymentMix data={analytics?.payment_mix ?? []} money={money} loading={analyticsLoading} />
		</div>

		<div class="dash-charts even">
			<MenuPerformance
				products={analytics?.top_products ?? []}
				productsByRevenue={analytics?.top_products_by_revenue ?? []}
				money={money}
				loading={analyticsLoading}
			/>

			<CategoryShare categories={analytics?.top_categories ?? []} money={money} loading={analyticsLoading} />
		</div>
	</section>
	{/if}

	{#if orderingEnabled() && !loading && stats && stats.orders_today === 0 && store?.is_published}
		<Reveal class="panel">
			<EmptyState
				title="No orders yet today"
				description="Share your store link or QR code: new orders will show up here."
			>
				{#snippet action()}
					<a class="btn btn-primary" href="/shop/marketing/kit?asset=qr">Open marketing kit</a>
				{/snippet}
			</EmptyState>
		</Reveal>
	{/if}
</div>

<BusinessPolicyModal
	bind:open={showPolicyModal}
	{tenantSlug}
	businessName={store?.name || tenantSlug}
	mandatory={false}
	onsigned={() => {
		policySignature = policyStore.getSignature(tenantSlug);
		policySigned = true;
	}}
/>

<style>
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
		font-size: var(--fs-meta);
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

	.dash-chip.status-open {
		background: color-mix(in srgb, var(--success) 12%, var(--surface));
		border-color: color-mix(in srgb, var(--success) 35%, var(--border));
		color: var(--success);
	}

	.dash-chip.status-busy {
		background: color-mix(in srgb, #f59e0b 14%, var(--surface));
		border-color: color-mix(in srgb, #f59e0b 40%, var(--border));
		color: color-mix(in srgb, #f59e0b 70%, var(--text));
	}

	.dash-chip.status-away {
		background: color-mix(in srgb, var(--accent) 12%, var(--surface));
		border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
		color: var(--accent-dark);
	}

	.dash-chip.status-closed {
		background: color-mix(in srgb, var(--danger) 12%, var(--surface));
		border-color: color-mix(in srgb, var(--danger) 35%, var(--border));
		color: var(--danger);
	}

	.dash-chip.ordering-open {
		background: color-mix(in srgb, var(--success) 10%, var(--surface));
		border-color: color-mix(in srgb, var(--success) 28%, var(--border));
		color: var(--success);
		font-weight: 550;
	}

	.dash-chip.ordering-closed {
		background: color-mix(in srgb, var(--danger) 10%, var(--surface));
		border-color: color-mix(in srgb, var(--danger) 28%, var(--border));
		color: var(--danger);
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
		font-size: var(--fs-h1);
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1.2;
		overflow-wrap: anywhere;
	}

	.dash-link-bar {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin-top: 0.55rem;
		min-width: 0;
		max-width: 100%;
		padding: 0.28rem 0.35rem 0.28rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: var(--radius, 8px);
		background: var(--surface-2);
	}

	.dash-link-url {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--fs-tab);
		font-family: var(--font-mono);
		color: var(--accent-dark);
		text-decoration: none;
	}

	.dash-link-url:hover {
		text-decoration: underline;
	}

	.dash-link-actions {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		gap: 0.15rem;
	}

	.dash-link-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.3rem 0.5rem;
		border: none;
		border-radius: calc(var(--radius, 8px) - 2px);
		background: transparent;
		color: var(--text-2);
		font: inherit;
		font-size: var(--fs-meta);
		font-weight: 550;
		text-decoration: none;
		cursor: pointer;
		white-space: nowrap;
		transition: background var(--tr), color var(--tr);
	}

	.dash-link-btn:hover {
		background: var(--surface);
		color: var(--text);
	}

	.dash-link-hint {
		margin: 0.4rem 0 0;
		font-size: var(--fs-meta);
		color: var(--text-3);
	}

	@media (max-width: 520px) {
		.dash-link-bar {
			flex-wrap: wrap;
			padding: 0.35rem;
		}

		.dash-link-url {
			flex: 1 1 100%;
			padding: 0.2rem 0.35rem;
		}

		.dash-link-actions {
			width: 100%;
			justify-content: flex-end;
		}
	}

	.dash-hero-right {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		align-items: stretch;
	}

	.dash-status-hint {
		margin: 0;
		font-size: var(--fs-meta);
		font-weight: 550;
		color: var(--text-3);
		letter-spacing: 0.01em;
	}

	.dash-status-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.dash-status {
		padding: 0.4rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface);
		color: var(--text-2);
		font-size: var(--fs-tab);
		font-weight: 550;
		font-family: inherit;
		cursor: pointer;
		transition:
			background var(--tr),
			border-color var(--tr),
			color var(--tr),
			opacity var(--tr);
	}

	.dash-status:disabled {
		opacity: 0.65;
		cursor: wait;
	}

	.dash-status.active.status-open {
		background: color-mix(in srgb, var(--success) 16%, var(--surface));
		border-color: color-mix(in srgb, var(--success) 45%, var(--border));
		color: var(--success);
		font-weight: 650;
	}

	.dash-status.active.status-busy {
		background: color-mix(in srgb, #f59e0b 18%, var(--surface));
		border-color: color-mix(in srgb, #f59e0b 45%, var(--border));
		color: color-mix(in srgb, #f59e0b 70%, var(--text));
		font-weight: 650;
	}

	.dash-status.active.status-away {
		background: color-mix(in srgb, var(--accent) 16%, var(--surface));
		border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
		color: var(--accent-dark);
		font-weight: 650;
	}

	.dash-status.active.status-closed {
		background: color-mix(in srgb, var(--danger) 16%, var(--surface));
		border-color: color-mix(in srgb, var(--danger) 45%, var(--border));
		color: var(--danger);
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
		font-size: var(--fs-title);
		font-weight: 650;
		color: var(--text);
	}

	.dash-section-head p {
		margin: 0.15rem 0 0;
		font-size: var(--fs-body);
		color: var(--text-3);
	}

	.dash-section.perf {
		gap: 1rem;
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
		/* The same surface as every .panel, so the tiles and the chart cards
		   beneath them read as one system. */
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--card-bg);
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
		font-size: var(--fs-meta);
		font-weight: 600;
		color: var(--text-3);
	}

	.dash-stat-value {
		font-family: var(--font-display);
		font-size: var(--fs-stat);
		font-weight: 750;
		letter-spacing: -0.02em;
		line-height: 1.15;
		font-variant-numeric: tabular-nums;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.dash-stat-hint {
		font-size: var(--fs-label);
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
		border-radius: var(--radius-lg);
		background: var(--card-bg);
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
		font-size: var(--fs-body);
		font-weight: 650;
		color: var(--text);
	}

	.dash-action-body span {
		display: block;
		font-size: var(--fs-code);
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
		font-size: var(--fs-title);
		font-weight: 650;
	}

	.dash-setup-head p {
		margin: 0.15rem 0 0;
		font-size: var(--fs-body);
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
		font-size: var(--fs-body);
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
		font-size: var(--fs-code);
		font-weight: 550;
		font-family: inherit;
		cursor: pointer;
	}

	.dash-windows button.active {
		background: var(--surface);
		color: var(--text);
		box-shadow: 0 1px 2px color-mix(in srgb, var(--text) 8%, transparent);
	}

	.dash-charts {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1rem;
		align-items: stretch;
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

		.dash-charts.even {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (min-width: 1020px) {
		.dash-charts.main {
			grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
		}
	}

	@media (min-width: 1100px) {
		.dash-actions {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
</style>
