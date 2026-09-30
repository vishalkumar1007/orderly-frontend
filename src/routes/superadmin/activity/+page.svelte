<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { fetchAuditLogs, fetchTenants } from '$lib/admin/api';
	import { errorMessage } from '$lib/admin/errors';
	import { formatDateTime, formatRelative, initials } from '$lib/admin/format';
	import type { AuditLog, Tenant } from '$lib/admin/types';
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
	 * Activity and audit, over one stream.
	 *
	 * They were two destinations, which forced an operator to guess which one
	 * held the answer before they could look. They are the same events read
	 * with different questions: Activity asks "what has been going on" and is
	 * meant to be read; Audit asks "who changed that, and was it allowed" and
	 * is meant to be filtered. One screen, two tabs, no guessing.
	 */

	const tabs = [
		{ id: 'feed', label: 'Activity' },
		{ id: 'audit', label: 'Audit log' }
	];

	let tab = $state('feed');
	let logs = $state<AuditLog[]>([]);
	let businesses = $state<Tenant[]>([]);
	let loading = $state(true);
	let refreshing = $state(false);
	let error = $state('');

	let search = $state('');
	let businessFilter = $state('');
	let resultFilter = $state('');

	let selected = $state<AuditLog | null>(null);
	let detailOpen = $state(false);

	async function load(quiet = false) {
		if (quiet) refreshing = true;
		else loading = true;
		error = '';
		try {
			const [rows, tenants] = await Promise.all([
				fetchAuditLogs(undefined, resultFilter || undefined),
				fetchTenants()
			]);
			logs = rows;
			businesses = tenants;
		} catch (err) {
			error = errorMessage(err, 'load platform activity');
		} finally {
			loading = false;
			refreshing = false;
		}
	}

	onMount(() => {
		const q = $page.url.searchParams.get('tab');
		if (q && tabs.some((t) => t.id === q)) tab = q;
		void load();
	});

	function setTab(next: string) {
		tab = next;
		goto(`?tab=${next}`, { replaceState: true, keepFocus: true, noScroll: true });
	}

	// The result filter is applied by the server, so changing it refetches.
	$effect(() => {
		resultFilter;
		void load(true);
	});

	const businessOptions = $derived(
		[...new Set(logs.map((l) => l.tenant).filter(Boolean) as string[])]
			.sort()
			.map((t) => ({ value: t, label: t }))
	);

	const filtered = $derived.by(() => {
		let rows = [...logs];
		const q = search.trim().toLowerCase();
		if (q) {
			rows = rows.filter(
				(l) =>
					l.actor.toLowerCase().includes(q) ||
					l.action.toLowerCase().includes(q) ||
					l.resource.toLowerCase().includes(q) ||
					(l.tenant || '').toLowerCase().includes(q)
			);
		}
		if (businessFilter) rows = rows.filter((l) => l.tenant === businessFilter);
		return rows;
	});

	const denied = $derived(logs.filter((l) => l.result === 'DENIED').length);
	const failed = $derived(logs.filter((l) => l.result === 'FAILURE').length);

	/** Events grouped by calendar day, newest first. */
	const days = $derived.by(() => {
		const groups = new Map<string, AuditLog[]>();
		for (const log of filtered) {
			const key = new Date(log.timestamp).toDateString();
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(log);
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

	/** The business a row refers to, when the console can link to it. */
	function businessHref(log: AuditLog): string | null {
		if (!log.tenant) return null;
		const hit = businesses.find((b) => b.name === log.tenant);
		return hit ? `/superadmin/businesses/${hit.id}` : null;
	}

	function tone(log: AuditLog): string {
		if (log.result === 'DENIED') return 'denied';
		if (log.result === 'FAILURE') return 'failed';
		return 'ok';
	}

	function clearFilters() {
		search = '';
		businessFilter = '';
		resultFilter = '';
	}

	function openDetail(log: AuditLog) {
		selected = log;
		detailOpen = true;
	}

	const AVATAR_TINTS = ['#7c3aed', '#0891b2', '#d97706', '#059669', '#dc2626', '#2563eb'];
	const tint = (name: string) => {
		let hash = 0;
		for (const ch of name) hash = (hash + ch.charCodeAt(0)) % AVATAR_TINTS.length;
		return AVATAR_TINTS[hash];
	};
</script>

{#if error}
	<div class="panel" style="margin-bottom:1rem;">
		<ErrorState message={error} onretry={() => load()} />
	</div>
{/if}

<Tabs {tabs} bind:active={tab} onchange={setTab} />

{#if tab === 'audit' && !loading && (denied > 0 || failed > 0)}
	<div class="alert alert-warn" style="margin-bottom:0.85rem;flex-wrap:wrap;gap:0.5rem;">
		<TriangleAlert size={16} strokeWidth={1.9} />
		<span>
			{denied} refused and {failed} failed attempt{denied + failed === 1 ? '' : 's'} in the last
			100 events. A refusal is the platform doing its job, not a fault.
		</span>
		<button
			type="button"
			class="btn btn-ghost btn-sm"
			style="margin-left:auto;"
			onclick={() => (resultFilter = 'DENIED')}
		>
			Review refusals
		</button>
	</div>
{/if}

<section class="panel panel-flush">
	<div class="sec-head">
		<div>
			<h2>{tab === 'feed' ? 'Recent activity' : 'Audit log'}</h2>
			<p>
				{#if tab === 'feed'}
					The last {logs.length} events across the platform, newest first — onboarding, plan
					changes, provider changes and every sign-in.
				{:else}
					The same record, filtered for review: who did it, to what, and whether it was
					allowed. Secrets are never recorded.
				{/if}
			</p>
		</div>
		<button type="button" class="btn btn-ghost btn-sm" onclick={() => load(true)}>
			<RefreshCw size={13} strokeWidth={2} class={refreshing ? 'spin' : ''} />
			Refresh
		</button>
	</div>

	<div style="padding:0 1.25rem 1rem;">
		<FilterBar>
			<SearchInput bind:value={search} placeholder="Person, action, business…" label="" />
			<Select
				bind:value={businessFilter}
				label="Business"
				id="act-business"
				allLabel="All businesses"
				options={businessOptions}
			/>
			{#if tab === 'audit'}
				<Select
					bind:value={resultFilter}
					label="Result"
					id="act-result"
					allLabel="Any result"
					options={[
						{ value: 'SUCCESS', label: 'Succeeded' },
						{ value: 'FAILURE', label: 'Failed' },
						{ value: 'DENIED', label: 'Refused' }
					]}
				/>
			{/if}
		</FilterBar>
	</div>

	{#if loading}
		<div style="padding:0 1.25rem 1.25rem;display:flex;flex-direction:column;gap:0.6rem;">
			{#each [1, 2, 3, 4, 5] as _, i (i)}
				<Skeleton height="2.6rem" />
			{/each}
		</div>
	{:else if filtered.length === 0}
		<EmptyState
			title={logs.length === 0 ? 'Nothing has happened yet' : 'No events match'}
			description={logs.length === 0
				? 'Onboarding a business, changing a plan or signing in all appear here.'
				: 'Try a different search term or clear the filters.'}
		>
			{#snippet action()}
				{#if logs.length > 0}
					<button type="button" class="btn btn-ghost btn-sm" onclick={clearFilters}>
						Clear filters
					</button>
				{/if}
			{/snippet}
		</EmptyState>
	{:else if tab === 'feed'}
		<div class="feed">
			{#each days as day (day.key)}
				<div class="day">
					<div class="day-head">
						<span>{day.label}</span>
						<span class="day-count">{day.rows.length} event{day.rows.length === 1 ? '' : 's'}</span>
					</div>
					<ul class="day-rows">
						{#each day.rows as log (log.id)}
							{@const href = businessHref(log)}
							<li class={['ev', tone(log)].join(' ')}>
								<span
									class="cell-avatar ev-avatar"
									style={`background:${tint(log.actor || log.actor_email || 'System')};`}
								>
									{initials(log.actor || log.actor_email || 'System')}
								</span>
								<div class="ev-body">
									<p class="ev-line">
										<strong>{log.actor || log.actor_email || 'System'}</strong>
										<span>{log.action.replaceAll('_', ' ').toLowerCase()}</span>
										{#if log.tenant}
											{#if href}
												<a href={href}>{log.tenant}</a>
											{:else}
												<strong>{log.tenant}</strong>
											{/if}
										{/if}
									</p>
									<p class="ev-meta">
										<span title={formatDateTime(log.timestamp)}>
											{formatRelative(log.timestamp)}
										</span>
										<span class="ev-sep">·</span>
										<span>{log.resource}</span>
										{#if log.result !== 'SUCCESS'}
											<span class="ev-sep">·</span>
											<StatusBadge status={String(log.result)} dot={false} />
										{/if}
									</p>
								</div>
								{#if href}
									<a class="ev-go" href={href} aria-label={`Open ${log.tenant}`}>
										<ArrowRight size={14} strokeWidth={2} />
									</a>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	{:else}
		<DataTable loading={false} empty={false}>
			{#snippet head()}
				<th>Event</th>
				<th>Actor</th>
				<th class="col-sm">Business</th>
				<th>Result</th>
				<th class="col-md">When</th>
				<th style="width:1%;"><span class="sr-only">Detail</span></th>
			{/snippet}
			{#each filtered as log (log.id)}
				<tr>
					<td>
						<strong style="font-weight:550;">{log.action.replaceAll('_', ' ')}</strong>
						<span class="muted" style="display:block;font-size:var(--fs-code);">
							{log.resource}{log.resource_id ? ` · ${log.resource_id}` : ''}
						</span>
					</td>
					<td>
						{log.actor || 'System'}
						{#if log.actor_email}
							<span class="muted" style="display:block;font-size:var(--fs-code);">{log.actor_email}</span>
						{/if}
					</td>
					<td class="col-sm" style="color:var(--text-2);">{log.tenant || '—'}</td>
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
	{/if}
</section>

<SlideOver bind:open={detailOpen} title="Event detail">
	{#if selected}
		<dl class="dl">
			<div>
				<dt>Event</dt>
				<dd style="font-weight:550;">{selected.action.replaceAll('_', ' ')}</dd>
			</div>
			<div><dt>When</dt><dd>{formatDateTime(selected.timestamp)}</dd></div>
			<div><dt>Actor</dt><dd>{selected.actor || 'System'}</dd></div>
			{#if selected.actor_email}
				<div><dt>Actor email</dt><dd class="mono">{selected.actor_email}</dd></div>
			{/if}
			<div><dt>Resource</dt><dd>{selected.resource}</dd></div>
			{#if selected.resource_id}
				<div><dt>Resource ID</dt><dd class="mono">{selected.resource_id}</dd></div>
			{/if}
			<div><dt>Business</dt><dd>{selected.tenant || '—'}</dd></div>
			<div><dt>Result</dt><dd><StatusBadge status={String(selected.result)} /></dd></div>
		</dl>

		{#if selected.metadata}
			<div style="margin-top:1.1rem;">
				<p class="field-label" style="margin:0 0 0.35rem;">Metadata</p>
				<pre class="code-block">{JSON.stringify(selected.metadata, null, 2)}</pre>
			</div>
		{/if}

		<p class="field-hint" style="margin-top:1rem;">
			Audit entries are written by the platform and cannot be edited or removed from this
			console. A configuration change records which service changed, never its credentials.
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
		max-width: 48rem;
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
		align-items: flex-start;
		gap: 0.65rem;
		padding: 0.65rem 0;
		border-bottom: 1px solid var(--border-subtle);
	}

	.ev:last-child {
		border-bottom: 0;
	}

	.ev-avatar {
		width: 1.75rem;
		height: 1.75rem;
		font-size: var(--fs-micro);
		color: #fff;
		border-radius: 999px;
		flex-shrink: 0;
		margin-top: 0.1rem;
	}

	.ev-body {
		flex: 1;
		min-width: 0;
	}

	.ev-line {
		margin: 0;
		font-size: var(--fs-body);
		line-height: 1.45;
		color: var(--text-2);
	}

	.ev-line strong {
		color: var(--text);
		font-weight: 600;
	}

	.ev-line a {
		font-weight: 600;
		color: var(--accent-dark);
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

	.ev-go {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.6rem;
		height: 1.6rem;
		border-radius: var(--radius-sm);
		color: var(--text-3);
		flex-shrink: 0;
	}

	.ev-go:hover {
		background: var(--surface-3);
		color: var(--accent-dark);
	}

	.ev.denied .ev-avatar {
		box-shadow: 0 0 0 2px var(--danger-bg);
	}

	.ev.failed .ev-avatar {
		box-shadow: 0 0 0 2px var(--warn-bg);
	}
</style>
