<script lang="ts">
	import { onMount } from 'svelte';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import { errorMessage } from '$lib/admin/errors';
	import { formatDateTime, formatRelative, rupees } from '$lib/admin/format';
	import {
		fetchActivity,
		fetchShopAuditLogs,
		type ActivityEvent,
		type ShopAuditLog
	} from '$lib/tenant/historyApi';
	import DataTable from '$lib/components/admin/DataTable.svelte';
	import EmptyState from '$lib/components/admin/EmptyState.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import FilterBar from '$lib/components/admin/FilterBar.svelte';
	import SearchInput from '$lib/components/admin/SearchInput.svelte';
	import Select from '$lib/components/admin/Select.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import SlideOver from '$lib/components/admin/SlideOver.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import Tabs from '$lib/components/admin/Tabs.svelte';

	/**
	 * Two different questions, deliberately kept apart.
	 *
	 * The audit log answers "who changed something" — prices, settings, access,
	 * who was invited or disabled. It is the record you bring to a dispute, and
	 * nothing in this console can edit it.
	 *
	 * Activity answers "what has the shop been doing" — orders moving through
	 * the workflow, and who moved them. It is operational history, and it is
	 * noisy by nature, which is exactly why it does not belong in the same list
	 * as a permission change.
	 */

	const tabs = [
		{ id: 'audit', label: 'Audit log' },
		{ id: 'activity', label: 'Order activity' }
	];

	let tab = $state('audit');

	let auditLogs = $state<ShopAuditLog[]>([]);
	let events = $state<ActivityEvent[]>([]);
	let loading = $state(true);
	let refreshing = $state(false);
	let error = $state('');

	let auditSearch = $state('');
	let resultFilter = $state('');
	let statusFilter = $state('');

	let selected = $state<ShopAuditLog | null>(null);
	let detailOpen = $state(false);

	async function load(quiet = false) {
		if (quiet) refreshing = true;
		else loading = true;
		error = '';
		try {
			[auditLogs, events] = await Promise.all([
				fetchShopAuditLogs(resultFilter || undefined),
				fetchActivity(statusFilter || undefined)
			]);
		} catch (err) {
			error = errorMessage(err, 'load activity');
		} finally {
			loading = false;
			refreshing = false;
		}
	}

	onMount(() => load());

	// Both filters are applied by the server, so a change is a refetch.
	$effect(() => {
		resultFilter;
		statusFilter;
		void load(true);
	});

	const filteredAudit = $derived.by(() => {
		const q = auditSearch.trim().toLowerCase();
		if (!q) return auditLogs;
		return auditLogs.filter(
			(log) =>
				log.actor.toLowerCase().includes(q) ||
				log.action.toLowerCase().includes(q) ||
				log.resource.toLowerCase().includes(q)
		);
	});

	const denied = $derived(auditLogs.filter((l) => l.result === 'DENIED').length);
	const failed = $derived(auditLogs.filter((l) => l.result === 'FAILURE').length);

	/** Events grouped by day, newest first. */
	const days = $derived.by(() => {
		const groups = new Map<string, ActivityEvent[]>();
		for (const event of events) {
			const key = new Date(event.at).toDateString();
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(event);
		}
		return [...groups.entries()].map(([key, rows]) => ({ key, label: dayLabel(key), rows }));
	});

	function dayLabel(key: string): string {
		const today = new Date().toDateString();
		const yesterday = new Date(Date.now() - 86_400_000).toDateString();
		if (key === today) return 'Today';
		if (key === yesterday) return 'Yesterday';
		return new Date(key).toLocaleDateString('en-IN', {
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		});
	}

	/** One readable sentence for an order transition. */
	function describe(event: ActivityEvent): string {
		const who = event.actor && event.actor !== 'system' ? event.actor : 'The system';
		switch (event.to_status) {
			case 'PENDING':
				return `Order #${event.order_number} was placed`;
			case 'ACCEPTED':
				return `${who} accepted order #${event.order_number}`;
			case 'PREPARING':
				return `${who} started preparing order #${event.order_number}`;
			case 'READY':
				return `${who} marked order #${event.order_number} ready`;
			case 'COMPLETED':
				return `Order #${event.order_number} was collected`;
			case 'CANCELLED':
				return `${who} cancelled order #${event.order_number}`;
			default:
				return `Order #${event.order_number} moved to ${event.to_status.toLowerCase()}`;
		}
	}

	function tone(status: string): string {
		if (status === 'CANCELLED') return 'bad';
		if (status === 'COMPLETED' || status === 'READY') return 'ok';
		return '';
	}

	function openDetail(log: ShopAuditLog) {
		selected = log;
		detailOpen = true;
	}
</script>

{#if error}
	<div class="panel" style="margin-bottom:0.85rem;">
		<ErrorState message={error} onretry={() => load()} />
	</div>
{/if}

<Tabs {tabs} bind:active={tab} />

{#if tab === 'audit'}
	{#if !loading && (denied > 0 || failed > 0)}
		<div class="alert alert-warn" style="margin-bottom:0.85rem;">
			<ShieldCheck size={16} strokeWidth={1.9} />
			<span>
				{denied} refused and {failed} failed sign-in attempt{denied + failed === 1 ? '' : 's'} in
				the recent record. A refusal is the platform doing its job, not a fault.
			</span>
			<button
				type="button"
				class="btn btn-ghost btn-sm"
				style="margin-left:auto;"
				onclick={() => (resultFilter = 'DENIED')}
			>
				Review
			</button>
		</div>
	{/if}

	<section class="panel panel-flush">
		<div class="sec-head">
			<div>
				<h2>Audit log</h2>
				<p>
					Who changed what in this business: prices and menu, settings, access, who was invited
					or disabled. Recorded automatically and not editable from here.
				</p>
			</div>
		</div>

		<div style="padding:0 1.25rem 1rem;">
			<FilterBar>
				<SearchInput bind:value={auditSearch} placeholder="Person, action or record…" label="" />
				<Select
					bind:value={resultFilter}
					label="Result"
					id="audit-result"
					allLabel="Any result"
					options={[
						{ value: 'SUCCESS', label: 'Succeeded' },
						{ value: 'FAILURE', label: 'Failed' },
						{ value: 'DENIED', label: 'Refused' }
					]}
				/>
			</FilterBar>
		</div>

		<DataTable
			{loading}
			empty={!loading && filteredAudit.length === 0}
			emptyTitle={auditSearch || resultFilter ? 'No matching entries' : 'Nothing recorded yet'}
			emptyDescription={auditSearch || resultFilter
				? 'Try a different search term or clear the result filter.'
				: 'Changes to your menu, settings, staff and access appear here as they happen.'}
		>
			{#snippet head()}
				<th>What changed</th>
				<th class="col-sm">Who</th>
				<th>Result</th>
				<th class="col-md">When</th>
				<th style="width:1%;"><span class="sr-only">Detail</span></th>
			{/snippet}

			{#each filteredAudit as log (log.id)}
				<tr>
					<td>
						<strong style="font-weight:550;">{log.action.replaceAll('_', ' ')}</strong>
						<span class="muted" style="display:block;font-size:var(--fs-code);">{log.resource}</span>
					</td>
					<td class="col-sm">
						{log.actor || 'System'}
						{#if log.actor_email}
							<span class="muted" style="display:block;font-size:var(--fs-meta);">{log.actor_email}</span>
						{/if}
					</td>
					<td><StatusBadge status={String(log.result)} /></td>
					<td class="muted col-md" style="white-space:nowrap;" title={formatDateTime(log.timestamp)}>
						{formatRelative(log.timestamp)}
					</td>
					<td>
						<button type="button" class="btn btn-ghost btn-sm" onclick={() => openDetail(log)}>
							Detail
						</button>
					</td>
				</tr>
			{/each}
		</DataTable>
	</section>
{:else}
	<section class="panel panel-flush">
		<div class="sec-head">
			<div>
				<h2>Order activity</h2>
				<p>
					Every order movement, newest first — placed, accepted, prepared, ready, collected.
					For searching the full record instead of reading it, use
					<a href="/shop/order-history">order history</a>.
				</p>
			</div>
			<button type="button" class="btn btn-ghost btn-sm" onclick={() => load(true)}>
				<RefreshCw size={13} strokeWidth={2} class={refreshing ? 'spin' : ''} />
				Refresh
			</button>
		</div>

		<div style="padding:0 1.25rem 1rem;max-width:16rem;">
			<Select
				bind:value={statusFilter}
				label="Show"
				id="act-status"
				allLabel="Every movement"
				options={[
					{ value: 'PENDING', label: 'Newly placed' },
					{ value: 'ACCEPTED', label: 'Accepted' },
					{ value: 'PREPARING', label: 'Started preparing' },
					{ value: 'READY', label: 'Marked ready' },
					{ value: 'COMPLETED', label: 'Collected' },
					{ value: 'CANCELLED', label: 'Cancelled' }
				]}
			/>
		</div>

		{#if loading}
			<div style="padding:0 1.25rem 1.25rem;display:flex;flex-direction:column;gap:0.6rem;">
				{#each [1, 2, 3, 4, 5] as _, i (i)}
					<Skeleton height="2.6rem" />
				{/each}
			</div>
		{:else if events.length === 0}
			<EmptyState
				title={statusFilter ? 'No movements of that kind yet' : 'No order activity yet'}
				description={statusFilter
					? 'Try showing every movement instead.'
					: 'As soon as orders start arriving, every step they take is recorded here.'}
			/>
		{:else}
			<div class="feed">
				{#each days as day (day.key)}
					<div class="day">
						<div class="day-head">
							<span>{day.label}</span>
							<span class="day-count">{day.rows.length} movement{day.rows.length === 1 ? '' : 's'}</span>
						</div>
						<ul class="day-rows">
							{#each day.rows as event (event.id)}
								<li class="ev">
									<span class={['ev-dot', tone(event.to_status)].join(' ')}></span>
									<div class="ev-body">
										<p class="ev-line">{describe(event)}</p>
										<p class="ev-meta">
											<span title={formatDateTime(event.at)}>{formatRelative(event.at)}</span>
											<span class="ev-sep">·</span>
											<span>{rupees(event.total)}</span>
											{#if event.customer_name}
												<span class="ev-sep">·</span>
												<span>{event.customer_name}</span>
											{/if}
										</p>
									</div>
									<StatusBadge status={event.to_status} dot={false} />
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</div>
		{/if}
	</section>
{/if}

<SlideOver bind:open={detailOpen} title="Audit entry">
	{#if selected}
		<dl class="dl">
			<div>
				<dt>What changed</dt>
				<dd style="font-weight:550;">{selected.action.replaceAll('_', ' ')}</dd>
			</div>
			<div><dt>When</dt><dd>{formatDateTime(selected.timestamp)}</dd></div>
			<div><dt>Who</dt><dd>{selected.actor || 'System'}</dd></div>
			{#if selected.actor_email}
				<div><dt>Their email</dt><dd class="mono">{selected.actor_email}</dd></div>
			{/if}
			<div><dt>Record</dt><dd>{selected.resource}</dd></div>
			{#if selected.resource_id}
				<div><dt>Record ID</dt><dd class="mono">{selected.resource_id}</dd></div>
			{/if}
			<div><dt>Result</dt><dd><StatusBadge status={String(selected.result)} /></dd></div>
		</dl>

		{#if selected.metadata}
			<div style="margin-top:1.1rem;">
				<p class="field-label" style="margin:0 0 0.35rem;">Details</p>
				<pre class="code-block">{JSON.stringify(selected.metadata, null, 2)}</pre>
			</div>
		{/if}

		<p class="field-hint" style="margin-top:1rem;">
			Audit entries are written by the platform and cannot be edited or removed from this
			console. Credentials are never recorded — a configuration change stores which service
			changed, never its password or key.
		</p>
	{/if}
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (detailOpen = false)}>Close</button>
	{/snippet}
</SlideOver>

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
		font-size: var(--fs-title);
		font-weight: 600;
	}

	.sec-head p {
		margin: 0.25rem 0 0;
		font-size: var(--fs-tab);
		line-height: 1.5;
		color: var(--text-3);
		max-width: 46rem;
	}

	.sec-head a {
		color: var(--accent-dark);
	}

	.feed {
		padding: 0 1.25rem 1.25rem;
	}

	.day + .day {
		margin-top: 1.1rem;
	}

	.day-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.6rem;
		padding-bottom: 0.4rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.day-head span:first-child {
		font-size: var(--fs-meta);
		font-weight: 650;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-3);
	}

	.day-count {
		font-size: var(--fs-meta);
		color: var(--text-3);
	}

	.day-rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.ev {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.65rem 0;
		border-bottom: 1px solid var(--border-subtle);
	}

	.ev:last-child {
		border-bottom: 0;
	}

	.ev-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 999px;
		background: var(--text-3);
		flex-shrink: 0;
	}

	.ev-dot.ok {
		background: var(--success);
	}

	.ev-dot.bad {
		background: var(--danger);
	}

	.ev-body {
		flex: 1;
		min-width: 0;
	}

	.ev-line {
		margin: 0;
		font-size: var(--fs-body);
		line-height: 1.4;
		color: var(--text);
	}

	.ev-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
		margin: 0.15rem 0 0;
		font-size: var(--fs-meta);
		color: var(--text-3);
	}

	.ev-sep {
		opacity: 0.5;
	}
</style>
