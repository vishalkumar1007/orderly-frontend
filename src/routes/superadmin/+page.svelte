<script lang="ts">
	import { onMount } from 'svelte';
	import type { Component } from 'svelte';
	import Activity from '@lucide/svelte/icons/activity';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Building2 from '@lucide/svelte/icons/building-2';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import IndianRupee from '@lucide/svelte/icons/indian-rupee';
	import PauseCircle from '@lucide/svelte/icons/pause-circle';
	import Plus from '@lucide/svelte/icons/plus';
	import ReceiptText from '@lucide/svelte/icons/receipt-text';
	import Rocket from '@lucide/svelte/icons/rocket';
	import Store from '@lucide/svelte/icons/store';
	import TimerReset from '@lucide/svelte/icons/timer-reset';
	import Users from '@lucide/svelte/icons/users';
	import { fetchDashboard, fetchSystemHealth } from '$lib/admin/api';
	import { errorLines } from '$lib/admin/errors';
	import { healthCheckMessage, healthSummary } from '$lib/admin/health';
	import { toast } from '$lib/components/admin/toast';
	import { formatRelative, initials, rupees, toNumber } from '$lib/admin/format';
	import type { DashboardData, SystemHealth } from '$lib/admin/types';
	import AttentionPanel from '$lib/components/admin/AttentionPanel.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import LineChartPanel from '$lib/components/admin/LineChartPanel.svelte';
	import Reveal from '$lib/components/admin/Reveal.svelte';
	import SeriesBars from '$lib/components/admin/SeriesBars.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import SystemHealthPanel from '$lib/components/admin/SystemHealthPanel.svelte';
	import TenantAvatar from '$lib/components/admin/TenantAvatar.svelte';

	/**
	 * The platform overview.
	 *
	 * It answers one question — "what is happening across my platform?" — in a
	 * fixed order: how many businesses there are and in what state, what they
	 * traded today, where the trend is going, and what needs the operator.
	 * Everything here is the sum across every tenant; a tenant only ever sees
	 * its own numbers in its own console.
	 */

	let data = $state<DashboardData | null>(null);
	let health = $state<SystemHealth | null>(null);
	let loading = $state(true);
	let healthLoading = $state(true);
	let healthError = $state('');
	let error = $state('');

	async function load() {
		loading = true;
		error = '';
		try {
			data = await fetchDashboard();
		} catch (err) {
			error = errorLines(err, 'load the dashboard').detail;
			data = null;
		} finally {
			loading = false;
		}
	}

	/**
	 * @param manual true when the operator pressed refresh on the health panel.
	 *
	 * The dashboard loads health once on open, silently. A check the operator
	 * asked for is confirmed, so pressing the button on an already-healthy
	 * platform still tells them the API answered.
	 */
	async function loadHealth(manual = false) {
		healthLoading = true;
		healthError = '';
		try {
			health = await fetchSystemHealth();
			if (manual) {
				const summary = healthSummary(health);
				const message = healthCheckMessage(health);
				if (summary.tone === 'bad') toast.error(message);
				else if (summary.tone === 'warn') toast.info(message);
				else toast.success(message);
			}
		} catch (err) {
			// The rest of the dashboard still works, so this does not become
			// the page's error — but it must be said. Silently rendering an
			// empty health panel reads as "nothing wrong" when the truth is
			// "nobody checked".
			const lines = errorLines(err, 'read system health');
			healthError = lines.detail;
			health = null;
			if (manual) toast.error(`${lines.title}. ${lines.detail}`);
		} finally {
			healthLoading = false;
		}
	}

	onMount(() => {
		void load();
		void loadHealth();
	});

	const totalBusinesses = $derived(data?.overview.total_tenants ?? 0);
	const isEmpty = $derived(!loading && data !== null && totalBusinesses === 0);
	const events = $derived(data?.platform_events.slice(0, 6) ?? []);
	const newest = $derived(data?.recently_created.slice(0, 5) ?? []);
	const businessWeeks = $derived((data?.tenants_by_week ?? []).slice(-8));

	/** Order counts for the visible window, oldest → newest. */
	const orderSeries = $derived(
		(data?.orders_by_day ?? []).slice(-7).map((d) => Number(d.order_count ?? 0))
	);
	const sparkMax = $derived(Math.max(...orderSeries, 1));

	/**
	 * The daily series, with every field the charts require present. The API
	 * types both `day` and `revenue` as optional because older rows predate
	 * them; the charts need a concrete value, so they are filled in here rather
	 * than guarded at every use.
	 */
	const dailySeries = $derived(
		(data?.orders_by_day ?? []).map((d) => ({
			day: String(d.day ?? ''),
			order_count: Number(d.order_count ?? 0),
			revenue: toNumber(d.revenue)
		}))
	);

	/** Revenue per day, for the revenue trend chart. */
	const revenueSeries = $derived(
		dailySeries.map((d) => ({ label: d.day.slice(5), value: d.revenue }))
	);

	/** First-vs-last comparison across the visible window. */
	const trend = $derived.by(() => {
		if (orderSeries.length < 2) return null;
		const first = orderSeries[0];
		const last = orderSeries[orderSeries.length - 1];
		if (first === 0 && last === 0) return { pct: 0, dir: 'flat' as const };
		const base = Math.max(first, 1);
		const pct = Math.round(((last - first) / base) * 100);
		return { pct, dir: pct > 0 ? ('up' as const) : pct < 0 ? ('down' as const) : ('flat' as const) };
	});

	const nowLabel = $derived(
		new Date().toLocaleString('en-IN', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
	);

	type Stat = {
		icon: Component;
		label: string;
		value: string;
		sub: string;
		href?: string;
		series?: number[];
		trend?: { pct: number; dir: 'up' | 'down' | 'flat' } | null;
	};

	/** Business estate: how many, and in what state. */
	const businessStats = $derived.by((): Stat[] => {
		if (!data) return [];
		const o = data.overview;
		return [
			{
				icon: Building2,
				label: 'Total businesses',
				value: String(o.total_tenants),
				sub: `${o.active_tenants} active on the platform`,
				href: '/superadmin/businesses'
			},
			{
				icon: CircleCheck,
				label: 'Active',
				value: String(o.active_tenants),
				sub: 'Trading normally',
				href: '/superadmin/businesses?status=ACTIVE'
			},
			{
				icon: TimerReset,
				label: 'On trial',
				value: String(o.trial_tenants),
				sub: `${data.expiring_subscriptions.length} ending within 14 days`,
				href: '/superadmin/plans?tab=subscriptions'
			},
			{
				icon: PauseCircle,
				label: 'Suspended',
				value: String(o.suspended_tenants),
				sub: o.suspended_tenants > 0 ? 'Storefronts unreachable' : 'None suspended',
				href: '/superadmin/businesses?status=SUSPENDED'
			}
		];
	});

	/** Platform activity: what those businesses did today. */
	const todayStats = $derived.by((): Stat[] => {
		if (!data) return [];
		return [
			{
				icon: ReceiptText,
				label: 'Orders today',
				value: String(data.business.orders_today),
				sub: `${toNumber(data.business.total_orders).toLocaleString('en-IN')} all time`,
				series: orderSeries,
				trend
			},
			{
				icon: IndianRupee,
				label: 'Revenue today',
				value: rupees(data.business.order_value_today),
				sub: `${rupees(data.business.revenue)} all time`
			},
			{
				icon: Users,
				label: 'Active users',
				value: String(data.business.active_users),
				sub: `${data.overview.pending_setup ?? 0} awaiting first sign-in`,
				href: '/superadmin/iam'
			}
		];
	});

	/** Rotating tint so activity avatars read as distinct people. */
	const AVATAR_TINTS = ['#7c3aed', '#0891b2', '#d97706', '#059669', '#dc2626', '#2563eb'];
	const tint = (i: number) => AVATAR_TINTS[i % AVATAR_TINTS.length];

	const quickActions = [
		{ href: '/superadmin/businesses/new', label: 'Onboard a business', icon: Plus },
		{ href: '/superadmin/businesses', label: 'Manage businesses', icon: Store },
		{ href: '/superadmin/plans', label: 'Plans & subscriptions', icon: Activity },
		{ href: '/superadmin/providers', label: 'Providers & integrations', icon: Users }
	];
</script>

{#if error}
	<div class="panel" style="margin-bottom:1rem;">
		<ErrorState message={error} onretry={load} />
	</div>
{/if}

{#if isEmpty}
	<!-- First run: guide the operator rather than showing a wall of zeroes. -->
	<Reveal class="panel">
		<div style="text-align:center;padding:2.25rem 1.5rem;">
			<span
				class="empty-icon"
				style="width:3rem;height:3rem;margin:0 auto 0.85rem;background:var(--accent-soft);color:var(--accent-dark);"
			>
				<Rocket size={22} strokeWidth={1.6} />
			</span>
			<h2
				style="font-family:var(--font-display);font-size:var(--fs-h1);font-weight:600;letter-spacing:-0.02em;margin:0 0 0.4rem;"
			>
				Your platform is ready
			</h2>
			<p
				style="margin:0 auto 1.4rem;max-width:32rem;font-size:var(--fs-body);color:var(--text-3);line-height:1.55;"
			>
				No businesses are onboarded yet. Onboard the first one to give it a storefront address,
				a configured menu and an administrator who can sign in.
			</p>
			<a class="btn btn-primary" href="/superadmin/businesses/new">
				<Store size={16} strokeWidth={2} />
				Onboard your first business
			</a>

			<ol class="setup-checklist" style="max-width:26rem;margin:2rem auto 0;text-align:left;">
				<li>Pick the business type — it sets the theme, layout and workflow</li>
				<li>Name the business and claim its subdomain</li>
				<li>Invite its administrator; they choose their own password</li>
				<li>They add a menu, then publish the storefront</li>
			</ol>
		</div>
	</Reveal>
{:else}
	<div class="dash">
		<!-- Estate -->
		<div class="stat-row">
			{#each [0, 1, 2, 3] as i (i)}
				{@const stat = businessStats[i]}
				<Reveal class="stat" delay={i * 50}>
					{#if stat}
						<div class="stat-top">
							<span class="stat-icon"><stat.icon size={15} strokeWidth={1.9} /></span>
							<span class="stat-label">{stat.label}</span>
						</div>
						<p class="stat-value">
							{#if stat.href}
								<a href={stat.href} style="color:inherit;text-decoration:none;">{stat.value}</a>
							{:else}
								{stat.value}
							{/if}
						</p>
						<p class="stat-hint">{stat.sub}</p>
					{:else}
						<div class="stat-top">
							<span class="stat-icon"><Building2 size={15} strokeWidth={1.9} /></span>
							<Skeleton height="0.7rem" width="5rem" />
						</div>
						<Skeleton height="1.5rem" width="4.5rem" />
						<Skeleton height="0.7rem" width="7rem" />
					{/if}
				</Reveal>
			{/each}
		</div>

		<!-- Today -->
		<Reveal class="panel today" delay={180}>
			<div class="today-head">
				<span class="dash-kicker">
					<span class="dash-live-dot"></span>
					Today · every business
				</span>
				<span class="muted" style="font-size:var(--fs-code);">{nowLabel}</span>
			</div>
			<div class="today-grid">
				{#each [0, 1, 2] as i (i)}
					{@const stat = todayStats[i]}
					<div class="today-cell">
						{#if stat}
							<div class="stat-top">
								<span class="stat-icon"><stat.icon size={15} strokeWidth={1.9} /></span>
								<span class="stat-label">{stat.label}</span>
								{#if stat.trend}
									<span class={['stat-trend', stat.trend.dir].join(' ')} style="margin-left:auto;">
										{stat.trend.dir === 'up' ? '↗' : stat.trend.dir === 'down' ? '↘' : '→'}
										{stat.trend.pct > 0 ? '+' : ''}{stat.trend.pct}%
									</span>
								{/if}
							</div>
							<p class="stat-value">{stat.value}</p>
							<p class="stat-hint">{stat.sub}</p>
							{#if stat.series && stat.series.length > 1}
								<div class="spark" aria-hidden="true">
									{#each stat.series as v, si (si)}
										<span
											style={`height:${Math.max((v / sparkMax) * 100, 6)}%;opacity:${0.35 + (v / sparkMax) * 0.65};`}
										></span>
									{/each}
								</div>
							{/if}
						{:else}
							<Skeleton height="0.7rem" width="5rem" />
							<Skeleton height="1.5rem" width="4.5rem" />
						{/if}
					</div>
				{/each}
			</div>
		</Reveal>

		<!-- Attention first: it is the only panel that asks for a decision. -->
		<Reveal delay={220}>
			<AttentionPanel
				suspended={data?.recently_suspended ?? []}
				expiring={data?.expiring_subscriptions ?? []}
				awaitingSetup={data?.awaiting_setup ?? []}
				{health}
				{healthError}
				loading={loading || healthLoading}
			/>
		</Reveal>

		<!-- Trends -->
		<div class="grid-2">
			<Reveal delay={260}>
				<LineChartPanel
					title="Orders — last 30 days"
					badge="All businesses"
					data={dailySeries}
					{loading}
				/>
			</Reveal>
			<Reveal delay={300}>
				<SeriesBars
					title="Revenue — last 30 days"
					badge="All businesses"
					data={revenueSeries}
					{loading}
					formatValue={(n) => rupees(n)}
				/>
			</Reveal>
		</div>

		<div class="bento">
			<Reveal class="bento-card" delay={340}>
				<div class="bento-head">
					<h3>Business growth</h3>
					<span class="bento-pill">By week</span>
				</div>
				{#if loading}
					<Skeleton height="92px" />
				{:else if businessWeeks.length === 0}
					<p class="muted" style="font-size:var(--fs-body);margin:0;">No onboarding data yet.</p>
				{:else}
					{@const wmax = Math.max(...businessWeeks.map((w) => Number(w.tenant_count ?? 0)), 1)}
					<div class="pulse-bars" aria-hidden="true">
						{#each businessWeeks as w, i (i)}
							<div
								style={`height:${Math.max((Number(w.tenant_count ?? 0) / wmax) * 100, 4)}%;`}
							></div>
						{/each}
					</div>
					<div class="pulse-labels">
						{#each businessWeeks as w, i (i)}
							<span>{w.week_start ? String(w.week_start).slice(5) : ''}</span>
						{/each}
					</div>
				{/if}
				<div class="bento-foot">
					<span><b>{totalBusinesses}</b> onboarded in total</span>
					<a href="/superadmin/businesses">Manage →</a>
				</div>
			</Reveal>

			<Reveal class="bento-card" delay={380}>
				<div class="bento-head">
					<h3>Recently onboarded</h3>
					<a class="bento-pill" href="/superadmin/businesses">View all</a>
				</div>
				{#if loading}
					<div class="act-rows">
						{#each [1, 2, 3] as _, i (i)}<Skeleton height="2.6rem" />{/each}
					</div>
				{:else if newest.length === 0}
					<p class="muted" style="font-size:var(--fs-body);margin:0;">No businesses yet.</p>
				{:else}
					<div class="act-rows">
						{#each newest as b (b.id)}
							<a
								class="act-row"
								href={`/superadmin/businesses/${b.id}`}
								style="text-decoration:none;color:inherit;"
							>
								<TenantAvatar name={b.name} size="sm" />
								<span class="act-text">
									<strong>{b.name}</strong>
									<span>{b.slug}</span>
								</span>
								<StatusBadge status={String(b.status)} dot={false} />
							</a>
						{/each}
					</div>
				{/if}
			</Reveal>

			<Reveal class="bento-card" delay={420}>
				<div class="bento-head">
					<h3>Recent platform activity</h3>
					<a class="bento-pill" href="/superadmin/activity">View log</a>
				</div>
				{#if loading}
					<div class="act-rows">
						{#each [1, 2, 3] as _, i (i)}<Skeleton height="2.6rem" />{/each}
					</div>
				{:else if events.length === 0}
					<p class="muted" style="font-size:var(--fs-body);margin:0;">No events recorded yet.</p>
				{:else}
					<div class="act-rows">
						{#each events as ev, i (ev.id)}
							<div class="act-row">
								<span
									class="cell-avatar"
									style="width:1.6rem;height:1.6rem;font-size:var(--fs-micro);background:{tint(
										i
									)};color:#fff;border-radius:999px;"
								>
									{initials(ev.actor || ev.actor_email || 'System')}
								</span>
								<span class="act-text">
									<strong>{ev.action.replaceAll('_', ' ')}</strong>
									<span>
										{ev.actor || ev.actor_email || 'System'} · {formatRelative(ev.timestamp)}
									</span>
								</span>
								<span class="act-dot"></span>
							</div>
						{/each}
					</div>
				{/if}
			</Reveal>

			<Reveal class="bento-card" delay={460}>
				<div class="bento-head">
					<h3>Quick actions</h3>
				</div>
				<div class="qa-rows">
					{#each quickActions as qa (qa.href)}
						<a class="qa-row" href={qa.href}>
							<span class="qa-icon"><qa.icon size={14} strokeWidth={1.9} /></span>
							<span>{qa.label}</span>
							<ArrowRight size={13} strokeWidth={2} class="qa-arrow" />
						</a>
					{/each}
				</div>
			</Reveal>
		</div>

		<!-- System health -->
		<Reveal delay={500}>
			<SystemHealthPanel
				compact
				{health}
				loading={healthLoading}
				error={healthError}
				onrefresh={() => void loadHealth(true)}
			/>
		</Reveal>
	</div>
{/if}

<style>
	.today-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.9rem;
	}

	.today-grid {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.today-cell + .today-cell {
		padding-left: 1rem;
		border-left: 1px solid var(--border-subtle);
	}

	@media (max-width: 700px) {
		.today-grid {
			grid-template-columns: 1fr;
		}

		.today-cell + .today-cell {
			padding-left: 0;
			border-left: 0;
			border-top: 1px solid var(--border-subtle);
			padding-top: 0.85rem;
		}
	}
</style>
