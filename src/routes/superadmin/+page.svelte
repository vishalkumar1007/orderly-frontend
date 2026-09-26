<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchDashboard } from '$lib/admin/api';
	import { formatRelative, initials, rupees, toNumber } from '$lib/admin/format';
	import type { DashboardData } from '$lib/admin/types';
	import Activity from '@lucide/svelte/icons/activity';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Building2 from '@lucide/svelte/icons/building-2';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import IndianRupee from '@lucide/svelte/icons/indian-rupee';
	import Plus from '@lucide/svelte/icons/plus';
	import ReceiptText from '@lucide/svelte/icons/receipt-text';
	import Rocket from '@lucide/svelte/icons/rocket';
	import Store from '@lucide/svelte/icons/store';
	import Users from '@lucide/svelte/icons/users';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import LineChartPanel from '$lib/components/admin/LineChartPanel.svelte';
	import Reveal from '$lib/components/admin/Reveal.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import SystemHealthPanel from '$lib/components/admin/SystemHealthPanel.svelte';
	import TenantAvatar from '$lib/components/admin/TenantAvatar.svelte';
	import type { Component } from 'svelte';

	type Data = DashboardData & {
		orders_by_day?: { day: string; order_count: number }[];
		tenants_by_week?: { week_start: string; tenant_count: number }[];
	};

	let data = $state<Data | null>(null);
	let loading = $state(true);
	let error = $state('');

	async function load() {
		loading = true;
		error = '';
		try {
			data = await fetchDashboard();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load dashboard';
			data = null;
		} finally {
			loading = false;
		}
	}

	onMount(load);

	const totalTenants = $derived(data?.overview.total_tenants ?? 0);
	const isEmpty = $derived(!loading && data !== null && totalTenants === 0);
	const events = $derived(data?.platform_events.slice(0, 6) ?? []);
	const newTenants = $derived(data?.recently_created.slice(0, 5) ?? []);
	const tenantWeeks = $derived(data?.tenants_by_week ?? []);

	/** Order counts for the last 7 days, oldest → newest. */
	const orderSeries = $derived(
		(data?.orders_by_day ?? []).slice(-7).map((d) => Number(d.order_count ?? 0))
	);

	/** First-vs-last comparison over the visible window. */
	const trend = $derived.by(() => {
		if (orderSeries.length < 2) return null;
		const first = orderSeries[0];
		const last = orderSeries[orderSeries.length - 1];
		if (first === 0 && last === 0) return { pct: 0, dir: 'flat' as const };
		const base = Math.max(first, 1);
		const pct = Math.round(((last - first) / base) * 100);
		return { pct, dir: pct > 0 ? ('up' as const) : pct < 0 ? ('down' as const) : ('flat' as const) };
	});

	const sparkMax = $derived(Math.max(...orderSeries, 1));

	const nowLabel = $derived(
		new Date().toLocaleString('en-IN', {
			weekday: 'short',
			hour: '2-digit',
			minute: '2-digit'
		})
	);

	/** Rotating accent so activity avatars read as distinct people. */
	const AVATAR_TINTS = ['#7c3aed', '#0891b2', '#d97706', '#059669', '#dc2626', '#2563eb'];
	const tint = (i: number) => AVATAR_TINTS[i % AVATAR_TINTS.length];

	type Stat = {
		icon: Component;
		label: string;
		value: string;
		sub: string;
		series?: number[];
		trend?: { pct: number; dir: 'up' | 'down' | 'flat' } | null;
	};

	const stats = $derived.by((): Stat[] => {
		if (!data) return [];
		return [
			{
				icon: Building2,
				label: 'Total businesses',
				value: String(data.overview.total_tenants),
				sub: `${data.overview.active_tenants} active · ${data.overview.suspended_tenants} suspended`
			},
			{
				icon: CircleCheck,
				label: "Today's orders",
				value: String(data.business.orders_today),
				sub: `Across all ${data.overview.total_tenants} businesses`,
				series: orderSeries,
				trend
			},
			{
				icon: IndianRupee,
				label: "Today's order value",
				value: rupees(data.business.order_value_today),
				sub: `${rupees(data.business.revenue)} lifetime, all businesses`
			},
			{
				icon: Users,
				label: 'Active users',
				value: String(data.business.active_users),
				sub: `${data.overview.pending_setup ?? 0} pending setup`
			}
		];
	});

	const quickActions = [
		{ href: '/superadmin/tenants/new', label: 'Onboard a business', icon: Plus },
		{ href: '/superadmin/tenants', label: 'Manage businesses', icon: Store },
		{ href: '/superadmin/users', label: 'Platform users', icon: Users },
		{ href: '/superadmin/activity', label: 'Audit log', icon: Activity }
	];
</script>

{#if error}
	<div class="panel" style="margin-bottom:1rem;">
		<ErrorState message={error} onretry={load} />
	</div>
{/if}

{#if isEmpty}
	<!-- First run: guide the operator instead of showing a wall of zeroes. -->
	<Reveal class="panel" >
		<div style="text-align:center;padding:2.25rem 1.5rem;">
			<span
				class="empty-icon"
				style="width:3rem;height:3rem;margin:0 auto 0.85rem;background:var(--accent-soft);color:var(--accent-dark);"
			>
				<Rocket size={22} strokeWidth={1.6} />
			</span>
			<h2
				style="font-family:var(--font-display);font-size:1.25rem;font-weight:600;letter-spacing:-0.02em;margin:0 0 0.4rem;"
			>
				Your platform is ready
			</h2>
			<p style="margin:0 auto 1.4rem;max-width:32rem;font-size:0.88rem;color:var(--text-3);line-height:1.55;">
				No food businesses are onboarded yet. Create your first tenant to generate a storefront
				URL, invite its administrator, and start accepting orders.
			</p>
			<a class="btn btn-primary" href="/superadmin/tenants/new">
				<Store size={16} strokeWidth={2} />
				Create your first tenant
			</a>

			<ol class="setup-checklist" style="max-width:24rem;margin:2rem auto 0;text-align:left;">
				<li>Create the tenant with its subdomain slug</li>
				<li>Share the setup link with the tenant admin</li>
				<li>Tenant admin adds a menu and publishes the store</li>
				<li>Share the storefront QR to start taking orders</li>
			</ol>
		</div>
	</Reveal>
{:else}
	<div class="dash">
		<!-- Hero -->
		<Reveal class="dash-hero" delay={0}>
			<div class="dash-hero-main">
				<span class="dash-kicker">
					<span class="dash-live-dot"></span>
					Platform-wide · all businesses
				</span>
				<h1>Platform overview</h1>
				<p>
					You run Orderly, not any single shop. Every order, rupee, and storefront below is the
					combined total across all onboarded businesses — use it to spot growth, spot churn,
					and confirm the platform is healthy. A tenant only ever sees their own shop's numbers.
				</p>
				<div class="dash-hero-meta">
					<span>{nowLabel}</span>
					<span class="dash-hero-sep">·</span>
					<span>{toNumber(data?.business.orders_today ?? 0)} orders today</span>
					<span class="dash-hero-sep">·</span>
					<span>{totalTenants} businesses</span>
				</div>
			</div>

			<div class="dash-hero-side">
				<div class="dash-orb-wrap" aria-hidden="true">
					<span class="dash-ring dash-ring-1"></span>
					<span class="dash-ring dash-ring-2"></span>
					<span class="dash-ring dash-ring-3"></span>
					<span class="dash-core"><Activity size={15} strokeWidth={2.4} /></span>
					<span class="dash-orb" style="top:20%;left:70%;"></span>
					<span class="dash-orb" style="top:44%;left:84%;"></span>
					<span class="dash-orb" style="top:70%;left:24%;"></span>
					<span class="dash-orb" style="top:78%;left:66%;"></span>
				</div>
			</div>
		</Reveal>

		<!-- Stat row -->
		<div class="stat-row">
			{#each [0, 1, 2, 3] as i (i)}
				{@const stat = stats[i]}
				<Reveal class="stat" delay={60 + i * 60}>
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
									<span style={`height:${Math.max((v / sparkMax) * 100, 6)}%;opacity:${0.35 + (v / sparkMax) * 0.65};`}
									></span>
								{/each}
							</div>
						{/if}
					{:else}
						<div class="stat-top">
							<span class="stat-icon"><ReceiptText size={15} strokeWidth={1.9} /></span>
							<Skeleton height="0.7rem" width="5rem" />
						</div>
						<Skeleton height="1.5rem" width="4.5rem" />
						<Skeleton height="0.7rem" width="7rem" />
					{/if}
				</Reveal>
			{/each}
		</div>

		<!-- Bento -->
		<div class="bento">
			<Reveal class="bento-wide" delay={120}>
				<LineChartPanel
					title="Orders — last 30 days"
					badge="All businesses"
					data={data?.orders_by_day ?? []}
					{loading}
				/>
			</Reveal>

			<Reveal class="bento-card" delay={180}>
				<div class="bento-head">
					<h3>New businesses</h3>
					<span class="bento-pill">All · by week</span>
				</div>
				{#if loading}
					<Skeleton height="92px" />
				{:else if tenantWeeks.length === 0}
					<p class="muted" style="font-size:0.82rem;margin:0;">No onboarding data yet.</p>
				{:else}
					{@const weeks = tenantWeeks.slice(-8)}
					{@const wmax = Math.max(...weeks.map((w) => Number(w.tenant_count ?? 0)), 1)}
					<div class="pulse-bars" aria-hidden="true">
						{#each weeks as w, i (i)}
							<div style={`height:${Math.max((Number(w.tenant_count ?? 0) / wmax) * 100, 4)}%;`}></div>
						{/each}
					</div>
					<div class="pulse-labels">
						{#each weeks as w, i (i)}
							<span>{w.week_start ? w.week_start.slice(5) : ''}</span>
						{/each}
					</div>
				{/if}
				<div class="bento-foot">
					<span><b>{totalTenants}</b> total onboarded</span>
					<a href="/superadmin/tenants">Manage →</a>
				</div>
			</Reveal>

			<Reveal class="bento-card" delay={240}>
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

			<Reveal class="bento-card" delay={300}>
				<div class="bento-head">
					<h3>Recently onboarded</h3>
					<a class="bento-pill" href="/superadmin/tenants">All · view all</a>
				</div>
				{#if loading}
					<div class="act-rows">
						{#each [1, 2, 3] as _, i (i)}<Skeleton height="2.6rem" />{/each}
					</div>
				{:else if newTenants.length === 0}
					<p class="muted" style="font-size:0.82rem;margin:0;">No tenants yet.</p>
				{:else}
					<div class="act-rows">
						{#each newTenants as t, i (t.id)}
							<a class="act-row" href={`/superadmin/tenants/${t.id}`} style="text-decoration:none;color:inherit;">
								<TenantAvatar name={t.name} size="sm" />
								<span class="act-text">
									<strong>{t.name}</strong>
									<span>{t.slug}</span>
								</span>
								<StatusBadge status={String(t.status)} dot={false} />
							</a>
						{/each}
					</div>
				{/if}
			</Reveal>

			<Reveal class="bento-card" delay={360}>
				<div class="bento-head">
					<h3>Platform activity</h3>
					<a class="bento-pill" href="/superadmin/activity">All · view log</a>
				</div>
				{#if loading}
					<div class="act-rows">
						{#each [1, 2, 3] as _, i (i)}<Skeleton height="2.6rem" />{/each}
					</div>
				{:else if events.length === 0}
					<p class="muted" style="font-size:0.82rem;margin:0;">No events recorded yet.</p>
				{:else}
					<div class="act-rows">
						{#each events as ev, i (ev.id)}
							<div class="act-row">
								<span
									class="cell-avatar"
									style="width:1.6rem;height:1.6rem;font-size:0.62rem;background:{tint(i)};color:#fff;border-radius:999px;"
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
		</div>

		<!-- Status -->
		<Reveal delay={420}>
			<SystemHealthPanel />
		</Reveal>
	</div>
{/if}
