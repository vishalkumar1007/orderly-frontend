<script lang="ts">
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Clock from '@lucide/svelte/icons/clock';
	import Mail from '@lucide/svelte/icons/mail';
	import PauseCircle from '@lucide/svelte/icons/pause-circle';
	import Plug from '@lucide/svelte/icons/plug';
	import type { Component } from 'svelte';
	import { formatRelative } from '$lib/admin/format';
	import type {
		AwaitingSetup,
		ExpiringSubscription,
		SystemHealth,
		TenantActivityItem
	} from '$lib/admin/types';
	import Skeleton from './Skeleton.svelte';

	/**
	 * Needs attention.
	 *
	 * The one panel on the dashboard that is not a number: it is the list of
	 * things that will not fix themselves. Every row is derived from real state
	 * — a suspended business, a trial about to lapse, an administrator who never
	 * signed in, a provider whose last test failed — and every row links to the
	 * screen where it can be dealt with.
	 *
	 * An empty list is a real answer, so the panel says so explicitly rather
	 * than rendering nothing.
	 */
	let {
		suspended = [] as TenantActivityItem[],
		expiring = [] as ExpiringSubscription[],
		awaitingSetup = [] as AwaitingSetup[],
		health = null as SystemHealth | null,
		healthError = '',
		loading = false,
		limit = 6
	}: {
		suspended?: TenantActivityItem[];
		expiring?: ExpiringSubscription[];
		awaitingSetup?: AwaitingSetup[];
		health?: SystemHealth | null;
		/** Set when the health probe itself failed, rather than reporting a fault. */
		healthError?: string;
		loading?: boolean;
		limit?: number;
	} = $props();

	type Severity = 'danger' | 'warn' | 'info';
	type Row = {
		id: string;
		severity: Severity;
		icon: Component;
		title: string;
		detail: string;
		href: string;
	};

	/** Days until an ISO timestamp, floored. Negative means already past. */
	function daysUntil(iso: string): number {
		const end = new Date(iso).getTime();
		if (Number.isNaN(end)) return 0;
		return Math.floor((end - Date.now()) / 86_400_000);
	}

	const rows = $derived.by((): Row[] => {
		const out: Row[] = [];

		// A health probe that did not answer is itself worth attention. Without
		// this the panel would quietly drop every component row and could show
		// "nothing needs attention" while the check was broken.
		if (healthError) {
			out.push({
				id: 'health-unreachable',
				severity: 'warn',
				icon: Plug,
				title: 'Component status could not be read',
				detail: healthError,
				href: '/superadmin/health'
			});
		}

		// A failing integration is first: it breaks invites and uploads for
		// every business at once, not for one.
		for (const component of health?.components ?? []) {
			if (component.status !== 'ERROR' && component.status !== 'WARNING') continue;
			// UNAVAILABLE is deliberately excluded — "we don't run that here" is
			// a fact about the deployment, not a problem to chase.
			out.push({
				id: `health-${component.id}`,
				severity: component.status === 'ERROR' ? 'danger' : 'warn',
				icon: Plug,
				title: `${component.name} ${component.status === 'ERROR' ? 'is failing' : 'needs attention'}`,
				detail: component.detail,
				href: component.href || '/superadmin/health'
			});
		}

		for (const business of suspended) {
			out.push({
				id: `suspended-${business.id}`,
				severity: 'danger',
				icon: PauseCircle,
				title: `${business.name} is suspended`,
				detail: 'Its storefront and console are unreachable until you reactivate it.',
				href: `/superadmin/businesses/${business.id}`
			});
		}

		for (const subscription of expiring) {
			const days = daysUntil(subscription.ends_at);
			const lapsed = days < 0;
			out.push({
				id: `expiring-${subscription.subscription_id}`,
				severity: lapsed || days <= 3 ? 'danger' : 'warn',
				icon: Clock,
				title: lapsed
					? `${subscription.tenant_name}'s ${label(subscription.status)} has lapsed`
					: `${subscription.tenant_name}'s ${label(subscription.status)} ends in ${days} day${days === 1 ? '' : 's'}`,
				detail: `On the ${subscription.plan} plan. Change the plan or let it lapse.`,
				href: `/superadmin/businesses/${subscription.tenant_id}?tab=subscription`
			});
		}

		for (const business of awaitingSetup) {
			out.push({
				id: `setup-${business.tenant_id}`,
				severity: 'warn',
				icon: Mail,
				title: `${business.tenant_name} has not been set up`,
				detail: `The administrator has not set a password. Onboarded ${formatRelative(business.created_at)}.`,
				href: `/superadmin/businesses/${business.tenant_id}?tab=users`
			});
		}

		const weight: Record<Severity, number> = { danger: 0, warn: 1, info: 2 };
		return out.sort((a, b) => weight[a.severity] - weight[b.severity]);
	});

	const shown = $derived(rows.slice(0, limit));
	const overflow = $derived(Math.max(0, rows.length - shown.length));

	function label(status: string): string {
		return status === 'TRIAL' ? 'trial' : 'subscription';
	}
</script>

<section class="panel panel-flush">
	<div class="bento-head" style="padding:0.95rem 1.25rem 0.5rem;">
		<h3 class="panel-h" style="margin:0;">Needs attention</h3>
		{#if !loading && rows.length > 0}
			<span class="bento-pill">{rows.length} open</span>
		{/if}
	</div>

	{#if loading}
		<div style="padding:0 1.25rem 1rem;display:flex;flex-direction:column;gap:0.6rem;">
			{#each [1, 2, 3] as _, i (i)}
				<Skeleton height="2.8rem" />
			{/each}
		</div>
	{:else if rows.length === 0}
		<div class="att-clear">
			<span class="empty-icon" style="background:var(--success-bg);color:var(--success);">
				<CircleCheck size={18} strokeWidth={1.9} />
			</span>
			<div>
				<strong>Nothing needs you right now</strong>
				<p>
					No suspended businesses, no trials ending in the next two weeks, no pending
					administrator setups, and no failing integrations.
				</p>
			</div>
		</div>
	{:else}
		<ul class="att-rows">
			{#each shown as row (row.id)}
				<li>
					<a class="att-row" href={row.href}>
						<span class={['att-icon', row.severity].join(' ')}>
							<row.icon size={14} strokeWidth={2} />
						</span>
						<span class="att-text">
							<strong>{row.title}</strong>
							<span>{row.detail}</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
		{#if overflow > 0}
			<p class="att-more">
				and {overflow} more — see <a href="/superadmin/businesses">all businesses</a>.
			</p>
		{/if}
	{/if}
</section>

<style>
	.att-rows {
		list-style: none;
		margin: 0;
		padding: 0 0.75rem 0.65rem;
	}

	.att-row {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
		padding: 0.6rem 0.5rem;
		border-radius: var(--radius-sm);
		text-decoration: none;
		color: inherit;
		transition: background var(--tr);
	}

	.att-row:hover {
		background: var(--surface-3);
	}

	.att-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.7rem;
		height: 1.7rem;
		border-radius: 8px;
		flex-shrink: 0;
		margin-top: 0.1rem;
	}

	.att-icon.danger {
		background: var(--danger-bg);
		color: var(--danger);
	}

	.att-icon.warn {
		background: var(--warn-bg);
		color: var(--warn);
	}

	.att-icon.info {
		background: var(--info-bg);
		color: var(--info);
	}

	.att-text {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}

	.att-text strong {
		font-size: 0.84rem;
		font-weight: 550;
		line-height: 1.35;
	}

	.att-text span {
		font-size: 0.76rem;
		color: var(--text-3);
		line-height: 1.45;
	}

	.att-clear {
		display: flex;
		align-items: flex-start;
		gap: 0.8rem;
		padding: 0.5rem 1.25rem 1.25rem;
	}

	.att-clear strong {
		font-size: 0.86rem;
		font-weight: 550;
	}

	.att-clear p {
		margin: 0.2rem 0 0;
		font-size: 0.78rem;
		color: var(--text-3);
		line-height: 1.5;
		max-width: 34rem;
	}

	.att-more {
		margin: 0;
		padding: 0 1.25rem 1rem;
		font-size: 0.76rem;
		color: var(--text-3);
	}

	.att-more a {
		color: var(--accent-dark);
	}
</style>
