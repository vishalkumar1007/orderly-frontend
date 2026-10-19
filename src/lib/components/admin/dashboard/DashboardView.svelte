<script lang="ts">
	import IconActivity from '@tabler/icons-svelte/icons/activity';
	import IconBuildingStore from '@tabler/icons-svelte/icons/building-store';
	import IconCreditCard from '@tabler/icons-svelte/icons/credit-card';
	import IconPlug from '@tabler/icons-svelte/icons/plug';
	import IconPlus from '@tabler/icons-svelte/icons/plus';
	import IconRefresh from '@tabler/icons-svelte/icons/refresh';
	import IconRocket from '@tabler/icons-svelte/icons/rocket';
	import IconSettings from '@tabler/icons-svelte/icons/settings';
	import IconShieldLock from '@tabler/icons-svelte/icons/shield-lock';
	import IconUserCog from '@tabler/icons-svelte/icons/user-cog';
	import { formatRelative, rupees, toNumber } from '$lib/admin/format';
	import { healthSummary } from '$lib/admin/health';
	import type { DashboardData, SystemHealth } from '$lib/admin/types';
	import AttentionPanel from '../AttentionPanel.svelte';
	import Skeleton from '../Skeleton.svelte';
	import SystemHealthPanel from '../SystemHealthPanel.svelte';
	import TenantAvatar from '../TenantAvatar.svelte';
	import Composition from './Composition.svelte';
	import GrowthBars from './GrowthBars.svelte';
	import MetricsStrip, { type Metric } from './MetricsStrip.svelte';
	import TrendChart from './TrendChart.svelte';

	/**
	 * The platform overview, as a view of already-loaded data so it can be
	 * rendered without a session.
	 *
	 * Reading order: the four numbers that matter, the trend beside what needs
	 * action, the shape of the estate, then the record of what happened. One
	 * accent, hairline rows, no decoration: colour appears only on data and
	 * status.
	 */
	let {
		data,
		health = null,
		healthError = '',
		healthLoading = false,
		loading = false,
		onrefresh,
		onrefreshhealth
	}: {
		data: DashboardData | null;
		health?: SystemHealth | null;
		healthError?: string;
		healthLoading?: boolean;
		loading?: boolean;
		onrefresh?: () => void;
		onrefreshhealth?: () => void;
	} = $props();

	const o = $derived(data?.overview);
	const isEmpty = $derived(!loading && data !== null && (o?.total_tenants ?? 0) === 0);

	const daily = $derived(
		(data?.orders_by_day ?? []).map((d) => ({
			day: String(d.day ?? ''),
			order_count: Number(d.order_count ?? 0),
			revenue: toNumber(d.revenue)
		}))
	);
	const weeks = $derived(data?.tenants_by_week ?? []);
	const newest = $derived(data?.recently_created.slice(0, 5) ?? []);
	const events = $derived(data?.platform_events.slice(0, 8) ?? []);

	/** This week against the week before. Null when there is no earlier week to compare. */
	function weekDelta(xs: number[]) {
		if (xs.length < 14) return null;
		const sum = (a: number[]) => a.reduce((p, c) => p + c, 0);
		const prev = sum(xs.slice(-14, -7));
		if (prev === 0) return null;
		const pct = Math.round(((sum(xs.slice(-7)) - prev) / prev) * 100);
		const dir = pct > 0 ? ('up' as const) : pct < 0 ? ('down' as const) : ('flat' as const);
		return { text: `${pct > 0 ? '+' : ''}${pct}% vs prev 7d`, dir };
	}

	const ordersSeries = $derived(daily.map((d) => d.order_count));
	const salesSeries = $derived(daily.map((d) => d.revenue));
	const newThisMonth = $derived(weeks.slice(-4).reduce((a, w) => a + Number(w.tenant_count ?? 0), 0));

	const metrics = $derived<Metric[]>([
		{
			label: 'Businesses',
			value: String(o?.total_tenants ?? 0),
			sub: o?.pending_setup ? `${o.pending_setup} awaiting setup` : 'All set up',
			delta: newThisMonth ? { text: `+${newThisMonth} this month`, dir: 'up' } : null,
			href: '/superadmin/businesses'
		},
		{
			label: 'Orders today',
			value: String(data?.business.orders_today ?? 0),
			sub: `${toNumber(data?.business.total_orders).toLocaleString('en-IN')} all time`,
			delta: weekDelta(ordersSeries),
			series: ordersSeries.slice(-14)
		},
		{
			label: 'Sales today',
			value: rupees(data?.business.order_value_today),
			sub: `${rupees(data?.business.revenue)} all time`,
			delta: weekDelta(salesSeries),
			series: salesSeries.slice(-14)
		},
		{
			label: 'Business users',
			value: String(data?.business.active_users ?? 0),
			sub: 'Active staff, all businesses',
			href: '/superadmin/iam'
		}
	]);

	/**
	 * A short attention list sits beside a tall chart and leaves a hole. With two
	 * alerts or fewer, the status block moves up under it so the column is as
	 * tall as the chart.
	 */
	const alertCount = $derived(
		(data?.recently_suspended.length ?? 0) +
			(data?.expiring_subscriptions.length ?? 0) +
			(data?.awaiting_setup.length ?? 0) +
			(health ? healthSummary(health).error : 0)
	);
	const quiet = $derived(!loading && alertCount <= 2);

	/** Audit actions are machine text; show a sentence, and an icon for what it concerns. */
	function eventLabel(action: string): string {
		const t = action.replace(/\s*\[[^\]]*\]\s*$/, '').replaceAll('.', ' ').replaceAll('_', ' ').trim();
		return t.charAt(0).toUpperCase() + t.slice(1);
	}
	function eventIcon(action: string): typeof IconPlug {
		const a = action.toLowerCase();
		if (/login|mfa|password|security|verify/.test(a)) return IconShieldLock;
		if (/plan|subscription|billing/.test(a)) return IconCreditCard;
		if (/business|tenant/.test(a)) return IconBuildingStore;
		if (/console|access|role|admin|user|invite/.test(a)) return IconUserCog;
		if (/config|smtp|storage|payment|provider|integration/.test(a)) return IconPlug;
		if (/setting/.test(a)) return IconSettings;
		return IconActivity;
	}

	const statusText: Record<string, string> = { ACTIVE: 'Active', SUSPENDED: 'Suspended', TRIAL: 'Trial' };
	const statusColor = (s: string) =>
		s === 'ACTIVE' ? 'var(--success)' : s === 'SUSPENDED' ? 'var(--danger)' : 'var(--warn)';

	const today = $derived(
		new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
	);
</script>

{#if isEmpty}
	<section class="panel empty">
		<IconRocket size={28} stroke={1.4} />
		<h2>Your platform is ready</h2>
		<p>
			No businesses yet. Onboard the first one to give it a storefront address, a configured menu
			and an administrator who can sign in.
		</p>
		<a class="btn btn-primary" href="/superadmin/businesses/new">
			<IconPlus size={14} stroke={1.8} /> Onboard your first business
		</a>
	</section>
{:else}
	<div class="dash">
		<div class="bar">
			<span class="meta">{today} · all businesses</span>
			<div class="acts">
				{#if onrefresh}
					<button type="button" class="btn btn-ghost btn-sm" onclick={onrefresh} disabled={loading}>
						<IconRefresh size={14} stroke={1.6} /> Refresh
					</button>
				{/if}
				<a class="btn btn-primary btn-sm" href="/superadmin/businesses/new">
					<IconPlus size={14} stroke={1.8} /> Onboard business
				</a>
			</div>
		</div>

		<MetricsStrip {metrics} {loading} />

		<div class="row main">
			<TrendChart data={daily} {loading} money={(n) => rupees(n)} />
			<div class="side">
				<AttentionPanel
					limit={4}
					suspended={data?.recently_suspended ?? []}
					expiring={data?.expiring_subscriptions ?? []}
					awaitingSetup={data?.awaiting_setup ?? []}
					{health}
					{healthError}
					loading={loading || healthLoading}
				/>
				{#if quiet}
					<Composition total={o?.total_tenants ?? 0} active={o?.active_tenants ?? 0} suspended={o?.suspended_tenants ?? 0} {loading} />
				{/if}
			</div>
		</div>

		<div class={['row', quiet ? 'pair' : 'trio'].join(' ')}>
			{#if !quiet}
				<Composition total={o?.total_tenants ?? 0} active={o?.active_tenants ?? 0} suspended={o?.suspended_tenants ?? 0} {loading} />
			{/if}
			<GrowthBars {weeks} {loading} />
			<section class="panel box">
				<header class="ph"><h3>Recently onboarded</h3><a href="/superadmin/businesses">View all</a></header>
				{#if loading}
					<div class="stack">{#each [1, 2, 3] as i (i)}<Skeleton height="2.2rem" />{/each}</div>
				{:else if newest.length === 0}
					<p class="none">No businesses yet.</p>
				{:else}
					<ul class="list">
						{#each newest as b (b.id)}
							<li>
								<a href={`/superadmin/businesses/${b.id}`}>
									<TenantAvatar name={b.name} size="sm" />
									<span class="grow">
										<strong>{b.name}</strong>
										<span class="sub">{b.slug}{b.at ? ` · ${formatRelative(b.at)}` : ''}</span>
									</span>
									<span class="status">
										<span class="dot" style={`background:${statusColor(String(b.status))}`}></span>
										{statusText[String(b.status)] ?? String(b.status)}
									</span>
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		</div>

		<section class="panel box">
			<header class="ph"><h3>Recent activity</h3><a href="/superadmin/activity">View log</a></header>
			{#if loading}
				<div class="stack">{#each [1, 2, 3, 4] as i (i)}<Skeleton height="2rem" />{/each}</div>
			{:else if events.length === 0}
				<p class="none">No events recorded yet.</p>
			{:else}
				<ul class="log">
					{#each events as ev (ev.id)}
						{@const Icon = eventIcon(ev.action)}
						<li>
							<span class="ic"><Icon size={14} stroke={1.6} /></span>
							<span class="what">{eventLabel(ev.action)}</span>
							<span class="who">{ev.actor || ev.actor_email || 'System'}</span>
							<span class="when">{formatRelative(ev.timestamp)}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<SystemHealthPanel compact {health} loading={healthLoading} error={healthError} onrefresh={onrefreshhealth} />
	</div>
{/if}

<style>
	.dash {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sp-6);
	}

	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-6);
		flex-wrap: wrap;
	}

	.meta {
		font-size: var(--fs-meta);
		color: var(--text-3);
	}

	.acts {
		display: flex;
		gap: var(--sp-4);
	}

	.row {
		display: grid;
		gap: var(--sp-6);
		align-items: stretch;
	}

	.main {
		grid-template-columns: minmax(0, 1.9fr) minmax(0, 1fr);
	}

	.trio {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.pair {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.side {
		display: flex;
		flex-direction: column;
		gap: var(--sp-6);
		min-width: 0;
	}

	@media (max-width: 1180px) {
		.main {
			grid-template-columns: minmax(0, 1fr);
		}

		.trio,
		.pair {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 640px) {
		.trio,
		.pair {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	.box {
		min-width: 0;
	}

	.ph {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--sp-4);
		margin-bottom: var(--sp-5);
	}

	.ph h3 {
		margin: 0;
		font-size: var(--fs-body);
		font-weight: 600;
		color: var(--text);
	}

	.ph a {
		font-size: var(--fs-meta);
		color: var(--accent);
		text-decoration: none;
	}

	.ph a:hover {
		text-decoration: underline;
	}

	.list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.list li + li {
		border-top: 1px solid var(--border-subtle);
	}

	.list a {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		min-height: 40px;
		margin: 0 calc(var(--sp-4) * -1);
		padding: var(--sp-3) var(--sp-4);
		border-radius: var(--radius-sm);
		color: inherit;
		text-decoration: none;
	}

	.list a:hover {
		background: var(--surface-hover);
	}

	.grow {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
	}

	.grow strong {
		font-size: var(--fs-body);
		font-weight: 500;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sub {
		font-size: var(--fs-meta);
		color: var(--text-3);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.status {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-3);
		font-size: var(--fs-meta);
		color: var(--text-2);
		white-space: nowrap;
	}

	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
	}

	.log {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.log li {
		display: grid;
		grid-template-columns: 18px minmax(0, 1fr) 9rem 6rem;
		align-items: center;
		gap: var(--sp-6);
		min-height: 36px;
		border-top: 1px solid var(--border-subtle);
		font-size: var(--fs-body);
	}

	.log li:first-child {
		border-top: 0;
	}

	.ic {
		color: var(--text-3);
		display: inline-flex;
	}

	.what {
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.who,
	.when {
		font-size: var(--fs-meta);
		color: var(--text-3);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.when {
		text-align: right;
	}

	@media (max-width: 640px) {
		.log li {
			grid-template-columns: 18px minmax(0, 1fr) auto;
		}

		.who {
			display: none;
		}
	}

	.stack {
		display: grid;
		gap: var(--sp-4);
	}

	.none {
		margin: 0;
		padding: var(--sp-10) 0;
		text-align: center;
		font-size: var(--fs-meta);
		color: var(--text-3);
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-4);
		padding: 48px var(--sp-11);
		text-align: center;
		color: var(--text-3);
	}

	.empty h2 {
		margin: var(--sp-2) 0 0;
		font-size: var(--fs-title);
		font-weight: 600;
		color: var(--text);
	}

	.empty p {
		margin: 0 0 var(--sp-4);
		max-width: 30rem;
		font-size: var(--fs-body);
		line-height: 1.55;
	}
</style>
