<script lang="ts">
	import { onMount } from 'svelte';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import IndianRupee from '@lucide/svelte/icons/indian-rupee';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import Rocket from '@lucide/svelte/icons/rocket';
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
	import { api } from '$lib/api/client';
	import EmptyState from '$lib/components/admin/EmptyState.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import Reveal from '$lib/components/admin/Reveal.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import ShopStat from '$lib/components/shop/ShopStat.svelte';
	import { toast } from '$lib/components/admin/toast';
	import { orderBoard } from '$lib/tenant/orders.svelte';
	import {
		fetchTenantAnalytics,
		percentChange,
		type AnalyticsWindow,
		type TenantAnalytics
	} from '$lib/tenant/analytics';
	import MetricCard from '$lib/components/admin/MetricCard.svelte';
	import TrendAreaChart from '$lib/components/admin/TrendAreaChart.svelte';
	import HourlyBarsChart from '$lib/components/admin/HourlyBarsChart.svelte';
	import StatusDonut from '$lib/components/admin/StatusDonut.svelte';
	import TopProductsPanel from '$lib/components/admin/TopProductsPanel.svelte';

	type Stats = {
		orders_today: number;
		revenue_today: string;
		pending_orders: number;
		preparing_orders: number;
		ready_orders: number;
		completed_today: number;
	};

	type StoreLink = {
		slug: string;
		public_path: string;
		public_host: string;
		is_published: boolean;
		status: string;
		name: string;
		setup_status: string;
	};

	type Setup = {
		setup_status: string;
		is_published: boolean;
		steps: { business_info: boolean; menu: boolean; payment: boolean; qr: boolean; launch: boolean };
	};

	let stats = $state<Stats | null>(null);
	let store = $state<StoreLink | null>(null);
	let setup = $state<Setup | null>(null);
	let error = $state('');
	let loading = $state(true);
	let publishing = $state(false);
	let analytics = $state<TenantAnalytics | null>(null);
	let analyticsLoading = $state(true);
	let window = $state<AnalyticsWindow>('30d');

	/** Whole-rupee amounts; the UI never shows paise. */
	const rupees = (n: number) =>
		'\u20b9' + Math.round(Number(n) || 0).toLocaleString('en-IN');

	const compactRupees = (n: number) => {
		const v = Math.round(Number(n) || 0);
		if (v >= 100000) return `\u20b9${Math.round(v / 1000)}k`;
		if (v >= 1000) return `\u20b9${(v / 1000).toFixed(1)}k`;
		return `\u20b9${v}`;
	};

	const CHECKLIST = [
		{ key: 'business_info' as const, label: 'Business details', href: '/shop' },
		{ key: 'menu' as const, label: 'Add your menu', href: '/shop/menu' },
		{ key: 'payment' as const, label: 'Payment methods', href: '/shop/setup' },
		{ key: 'qr' as const, label: 'QR code & share link', href: '/shop/setup' },
		{ key: 'launch' as const, label: 'Go live', href: '/shop/setup' }
	];

	const doneCount = $derived(
		setup ? CHECKLIST.filter((c) => setup!.steps[c.key]).length : 0
	);
	const progress = $derived(Math.round((doneCount / CHECKLIST.length) * 100));
	const readyToLaunch = $derived(Boolean(setup && !setup.is_published && setup.steps.menu));

	async function loadAnalytics(target: AnalyticsWindow) {
		analyticsLoading = true;
		try {
			analytics = await fetchTenantAnalytics(target);
		} catch {
			// Analytics are an enhancement: the rest of the dashboard still works.
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
				const [s, l, p] = await Promise.all([
					api<Stats>('/api/v1/tenant/dashboard'),
					api<StoreLink>('/api/v1/tenant/store-link'),
					api<Setup>('/api/v1/tenant/setup')
				]);
				if (cancelled) return;
				stats = s;
				store = l;
				setup = p;
			} catch (err) {
				if (!cancelled) error = err instanceof Error ? err.message : 'Failed to load';
			} finally {
				if (!cancelled) loading = false;
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	async function togglePublish() {
		if (!store || publishing) return;
		publishing = true;
		try {
			const path = store.is_published ? '/api/v1/tenant/unpublish' : '/api/v1/tenant/publish';
			const res = await api<StoreLink>(path, { method: 'POST' });
			store = { ...store, ...res };
			toast.success(store.is_published ? 'Your store is live' : 'Store unpublished');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not change publish state');
		} finally {
			publishing = false;
		}
	}

	/** Sparkline series, most recent last. */
	const revenueSeries = $derived(
		analytics ? analytics.orders_by_day.slice(-14).map((d) => d.revenue) : []
	);
	const orderSeries = $derived(
		analytics ? analytics.orders_by_day.slice(-14).map((d) => d.order_count) : []
	);
	/** Seven-day window, so the week card's sparkline is not the month one again. */
	const weekSeries = $derived(
		analytics ? analytics.orders_by_day.slice(-7).map((d) => d.order_count) : []
	);

	const storefrontUrl = $derived(
		store ? `http://${store.public_host}${store.public_path}` : ''
	);
</script>

{#if error}
	<ErrorState message={error} />
{/if}

<!-- ---------- Store status hero ---------- -->
{#if store}
	<Reveal class="osh-hero">
		<div class="osh-hero-main">
			<div class="osh-hero-top">
				<span class={['oschip', store.is_published ? 'live' : 'off'].join(' ')}>
					{#if store.is_published}
						<span class="osdot pulse"></span>Live for customers
					{:else}
						Not published
					{/if}
				</span>
				<StatusBadge status={store.setup_status} />
			</div>
			<h2 class="osh-hero-title">{store.name}</h2>
			{#if storefrontUrl}
				<a class="osh-hero-url" href={storefrontUrl} target="_blank" rel="noreferrer">
					{storefrontUrl.replace(/^https?:\/\//, '')}
					<ExternalLink size={13} strokeWidth={1.9} />
				</a>
			{/if}
		</div>
		<div class="osh-hero-actions">
			<button
				class={['btn', store.is_published ? 'btn-ghost' : 'btn-primary'].join(' ')}
				type="button"
				disabled={publishing}
				onclick={togglePublish}
			>
				{#if store.is_published}
					<EyeOff size={15} strokeWidth={1.9} /> Unpublish
				{:else}
					<Eye size={15} strokeWidth={1.9} /> Publish store
				{/if}
			</button>
		</div>
	</Reveal>
{/if}

<!-- ---------- Today at a glance ---------- -->
{#if loading}
	<div class="osstats">
		{#each [1, 2, 3, 4, 5, 6] as _, i (i)}
			<div class="osstat"><Skeleton height="2.3rem" /></div>
		{/each}
	</div>
{:else if stats}
	<div class="osstats">
		<ShopStat
			label="Orders today"
			value={stats.orders_today}
			icon={ShoppingBag}
			accent
		/>
		<ShopStat label="Revenue today" value={`₹${stats.revenue_today}`} icon={IndianRupee} />
		<ShopStat label="New" value={stats.pending_orders} hint="need accepting" />
		<ShopStat label="Preparing" value={stats.preparing_orders} />
		<ShopStat label="Ready" value={stats.ready_orders} />
		<ShopStat label="Completed" value={stats.completed_today} hint="today" />
	</div>
{/if}

<!-- ---------- Analytics ---------- -->
<section class="anl">
	<div class="anl-head">
		<div>
			<h2 class="anl-title">Performance</h2>
			<p class="anl-sub">How the shop is trading, and when it is busiest.</p>
		</div>
		<div class="anl-windows" role="tablist" aria-label="Time range">
			{#each [{ v: '7d', l: '7 days' }, { v: '14d', l: '14 days' }, { v: '30d', l: '30 days' }, { v: '90d', l: '90 days' }] as opt (opt.v)}
				<button
					type="button"
					role="tab"
					aria-selected={window === opt.v}
					class:active={window === opt.v}
					onclick={() => {
						window = opt.v as AnalyticsWindow;
						void loadAnalytics(opt.v as AnalyticsWindow);
					}}
				>
					{opt.l}
				</button>
			{/each}
		</div>
	</div>

	<!-- Headline figures with period-over-period trend. -->
	<div class="anl-metrics">
		<MetricCard
			label="Revenue (30 days)"
			value={analyticsLoading ? '—' : rupees(analytics?.revenue_30d ?? 0)}
			hint="last 30 days"
			loading={analyticsLoading}
			trend={analytics ? percentChange(analytics.revenue_30d, analytics.revenue_prev_30d) : null}
			series={revenueSeries}
		/>
		<MetricCard
			label="Orders (30 days)"
			value={analyticsLoading ? '—' : (analytics?.orders_30d ?? 0)}
			hint="last 30 days"
			loading={analyticsLoading}
			trend={analytics ? percentChange(analytics.orders_30d, analytics.orders_prev_30d) : null}
			series={orderSeries}
		/>
		<MetricCard
			label="Average order"
			value={analyticsLoading ? '—' : rupees(analytics?.avg_order_value_30d ?? 0)}
			hint="per order, last 30 days"
			loading={analyticsLoading}
		/>
		<MetricCard
			label="Orders this week"
			value={analyticsLoading ? '—' : (analytics?.orders_7d ?? 0)}
			hint="last 7 days"
			loading={analyticsLoading}
			series={weekSeries}
		/>
	</div>

	<!-- Revenue and order volume over the window. -->
	<TrendAreaChart
		title="Revenue and orders"
		data={analytics?.orders_by_day ?? []}
		loading={analyticsLoading}
		formatValue={rupees}
	/>

	<div class="anl-grid">
		<StatusDonut data={analytics?.status_breakdown ?? []} loading={analyticsLoading} />
		<HourlyBarsChart data={analytics?.orders_by_hour ?? []} loading={analyticsLoading} />
	</div>

	<TopProductsPanel
		data={analytics?.top_products ?? []}
		loading={analyticsLoading}
		formatMoney={rupees}
	/>
</section>

<!-- ---------- Getting started ---------- -->
{#if setup && !setup.is_published}
	<Reveal class="panel osh-panel" delay={80}>
		<div class="osh-panel-head">
			<div>
				<h3 class="panel-h" style="margin:0 0 0.15rem;">Finish setting up</h3>
				<p class="panel-note" style="margin:0;">
					{doneCount} of {CHECKLIST.length} done · {progress}%
				</p>
			</div>
			{#if readyToLaunch}
				<a class="btn btn-primary btn-sm" href="/shop/setup">
					<Rocket size={14} strokeWidth={2.1} /> Go live
				</a>
			{/if}
		</div>

		<div
			class="osh-progress"
			role="progressbar"
			aria-valuenow={progress}
			aria-valuemin="0"
			aria-valuemax="100"
			aria-label="Setup progress"
		>
			<span style={`width:${progress}%`}></span>
		</div>

		<ul class="osh-checklist">
			{#each CHECKLIST as c (c.key)}
				{@const isDone = setup!.steps[c.key]}
				<li>
					<a class={['osh-check', isDone ? 'done' : ''].join(' ')} href={c.href}>
						<span class="osh-check-box">
							{#if isDone}<CircleCheck size={15} strokeWidth={2.2} />{/if}
						</span>
						<span class="osh-check-label">{c.label}</span>
						<ArrowRight size={14} strokeWidth={1.9} class="osh-check-arrow" />
					</a>
				</li>
			{/each}
		</ul>
	</Reveal>
{/if}

<!-- ---------- Quick actions ---------- -->
<Reveal class="panel osh-panel" delay={140}>
	<h3 class="panel-h" style="margin:0 0 0.6rem;">Quick actions</h3>
	<div class="osh-actions">
		<a class="osh-action" href="/shop/orders">
			<span class="osh-action-icon"><ShoppingBag size={17} strokeWidth={1.85} /></span>
			<span class="osh-action-text">
				<strong>Orders</strong>
				<span>{orderBoard.activeCount} live right now</span>
			</span>
			<ArrowRight size={14} strokeWidth={1.9} />
		</a>
		<a class="osh-action" href="/kitchen">
			<span class="osh-action-icon"><UtensilsCrossed size={17} strokeWidth={1.85} /></span>
			<span class="osh-action-text">
				<strong>Kitchen board</strong>
				<span>Prep view for the counter</span>
			</span>
			<ArrowRight size={14} strokeWidth={1.9} />
		</a>
		<a class="osh-action" href="/shop/menu">
			<span class="osh-action-icon"><UtensilsCrossed size={17} strokeWidth={1.85} /></span>
			<span class="osh-action-text">
				<strong>Menu</strong>
				<span>Items, prices and availability</span>
			</span>
			<ArrowRight size={14} strokeWidth={1.9} />
		</a>
		<a class="osh-action" href="/shop/setup">
			<span class="osh-action-icon"><ListChecks size={17} strokeWidth={1.85} /></span>
			<span class="osh-action-text">
				<strong>Setup</strong>
				<span>Payments, QR and launch</span>
			</span>
			<ArrowRight size={14} strokeWidth={1.9} />
		</a>
	</div>
</Reveal>

{#if !loading && stats && stats.orders_today === 0 && doneCount === CHECKLIST.length}
	<Reveal class="panel" delay={200}>
		<EmptyState
			title="No orders yet"
			description="Share your storefront link or QR code and orders will start appearing here."
		>
			{#snippet action()}
				<a class="btn btn-primary" href="/shop/setup">Get your QR code</a>
			{/snippet}
		</EmptyState>
	</Reveal>
{/if}

<style>
	.osh-hero {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 1rem;
		margin-bottom: 0.85rem;
		border-radius: var(--radius-lg);
		border: 1px solid var(--border);
		background:
			radial-gradient(120% 140% at 100% 0%, var(--accent-soft) 0%, transparent 60%),
			var(--surface);
	}

	/* min-width:0 lets a long shop name ellipsis instead of pushing the
	   publish button off the edge on narrow phones. */
	.osh-hero-main {
		min-width: 0;
	}

	.osh-hero-top {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-bottom: 0.5rem;
	}

	.osh-hero-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1.2;
		overflow-wrap: anywhere;
	}

	.osh-hero-url {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		margin-top: 0.3rem;
		font-size: 0.8rem;
		font-family: var(--font-mono);
		color: var(--accent-dark);
		text-decoration: none;
		word-break: break-all;
	}

	.osh-hero-actions {
		display: flex;
		gap: 0.5rem;
	}

	.osh-hero-actions .btn {
		flex: 1;
		min-height: 2.75rem;
	}

	.osh-panel {
		margin-bottom: 0.85rem;
	}

	.osh-panel-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.7rem;
	}

	.osh-progress {
		height: 0.4rem;
		border-radius: 999px;
		background: var(--surface-3);
		overflow: hidden;
		margin-bottom: 0.75rem;
	}

	.osh-progress span {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, var(--accent), var(--accent-2));
		transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.osh-checklist {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.osh-check {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-height: 2.6rem;
		padding: 0.4rem 0.5rem;
		border-radius: 10px;
		text-decoration: none;
		color: var(--text);
		font-size: 0.88rem;
		-webkit-tap-highlight-color: transparent;
		transition: background var(--tr);
	}

	.osh-check:hover {
		background: var(--surface-2);
	}

	.osh-check-box {
		flex: none;
		width: 1.35rem;
		height: 1.35rem;
		border-radius: 999px;
		border: 1.5px solid var(--border);
		display: grid;
		place-items: center;
		color: var(--success);
	}

	.osh-check.done .osh-check-box {
		border-color: color-mix(in srgb, var(--success) 45%, var(--border));
		background: var(--success-bg);
	}

	.osh-check.done .osh-check-label {
		color: var(--text-2);
	}

	.osh-check-label {
		flex: 1;
		min-width: 0;
		font-weight: 550;
	}

	.osh-check-arrow {
		flex: none;
		color: var(--text-3);
	}

	.osh-actions {
		display: grid;
		gap: 0.45rem;
		grid-template-columns: 1fr;
	}

	.osh-action {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		min-height: 3.1rem;
		padding: 0.55rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--text-3);
		text-decoration: none;
		-webkit-tap-highlight-color: transparent;
		transition: border-color var(--tr), transform var(--tr);
	}

	.osh-action:hover {
		border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
	}

	.osh-action:active {
		transform: scale(0.99);
	}

	.osh-action-icon {
		flex: none;
		width: 2.2rem;
		height: 2.2rem;
		border-radius: 9px;
		background: var(--accent-soft);
		color: var(--accent-dark);
		display: grid;
		place-items: center;
	}

	.osh-action-text {
		flex: 1;
		min-width: 0;
		line-height: 1.3;
	}

	.osh-action-text strong {
		display: block;
		font-size: 0.88rem;
		font-weight: 620;
		color: var(--text);
	}

	.osh-action-text span {
		display: block;
		font-size: 0.74rem;
		color: var(--text-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Two columns once there is room, four on a wide screen. */
	@media (min-width: 620px) {
		.osh-hero {
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
		}

		.osh-hero-actions .btn {
			flex: none;
			min-width: 10rem;
		}

		.osh-actions {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (min-width: 1000px) {
		.osh-actions {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}

	.anl {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		margin-top: 1.25rem;
	}

	.anl-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.anl-title {
		margin: 0;
		font-size: 1rem;
		font-weight: 650;
		color: var(--text-1);
	}

	.anl-sub {
		margin: 0.2rem 0 0;
		font-size: 0.8rem;
		color: var(--text-3);
	}

	.anl-windows {
		display: inline-flex;
		gap: 2px;
		padding: 2px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
	}

	.anl-windows button {
		padding: 0.3rem 0.6rem;
		border: 0;
		border-radius: calc(var(--radius-sm) - 1px);
		background: transparent;
		color: var(--text-3);
		font-size: 0.76rem;
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
	}

	.anl-windows button.active {
		background: var(--surface-1);
		color: var(--text-1);
	}

	/* auto-fit keeps the row readable from a phone to a wide desktop without
	   a media query, and each card keeps a usable minimum width. */
	.anl-metrics {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
	}

	.anl-grid {
		display: grid;
		gap: 0.9rem;
		grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr));
	}
</style>
