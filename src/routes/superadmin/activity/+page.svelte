<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchAuditLogs } from '$lib/admin/api';
	import { formatDateTime, formatRelative } from '$lib/admin/format';
	import type { AuditLog } from '$lib/admin/types';
	import DataTable from '$lib/components/admin/DataTable.svelte';
	import EmptyState from '$lib/components/admin/EmptyState.svelte';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import FilterBar from '$lib/components/admin/FilterBar.svelte';
	import SearchInput from '$lib/components/admin/SearchInput.svelte';
	import Select from '$lib/components/admin/Select.svelte';
	import SlideOver from '$lib/components/admin/SlideOver.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';

	let logs = $state<AuditLog[]>([]);
	let loading = $state(true);
	let error = $state('');
	let search = $state('');
	let resultFilter = $state('');
	let tenantFilter = $state('');
	let selected = $state<AuditLog | null>(null);
	let detailOpen = $state(false);

	async function load() {
		loading = true;
		error = '';
		try {
			logs = await fetchAuditLogs(undefined, resultFilter || undefined);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load activity';
		} finally {
			loading = false;
		}
	}

	onMount(load);

	// The server filters by result, so refetch when it changes.
	$effect(() => {
		resultFilter;
		load();
	});

	const tenantOptions = $derived(
		[...new Set(logs.map((l) => l.tenant).filter(Boolean) as string[])].map((t) => ({
			value: t,
			label: t
		}))
	);

	const deniedCount = $derived(logs.filter((l) => l.result === 'DENIED').length);
	const failureCount = $derived(logs.filter((l) => l.result === 'FAILURE').length);

	const filtered = $derived.by(() => {
		let list = [...logs];
		const q = search.trim().toLowerCase();
		if (q) {
			list = list.filter(
				(l) =>
					l.actor.toLowerCase().includes(q) ||
					l.action.toLowerCase().includes(q) ||
					l.resource.toLowerCase().includes(q) ||
					(l.tenant || '').toLowerCase().includes(q)
			);
		}
		if (tenantFilter) list = list.filter((l) => l.tenant === tenantFilter);
		return list;
	});

	function openDetail(log: AuditLog) {
		selected = log;
		detailOpen = true;
	}

	function clearFilters() {
		search = '';
		resultFilter = '';
		tenantFilter = '';
	}
</script>

{#if error}
	<div class="panel" style="margin-bottom:1rem;"><ErrorState message={error} onretry={load} /></div>
{/if}

{#if !loading && (deniedCount > 0 || failureCount > 0)}
	<div class="alert alert-warn" style="margin-bottom:0.85rem;flex-wrap:wrap;gap:0.5rem;">
		<TriangleAlert size={16} strokeWidth={1.9} />
		<span>
			{deniedCount} denied and {failureCount} failed authentication attempt{deniedCount + failureCount === 1 ? '' : 's'} in the
			last 100 events.
		</span>
		<button
			type="button"
			class="btn btn-ghost btn-sm"
			style="margin-left:auto;"
			onclick={() => (resultFilter = 'DENIED')}
		>
			Review denials
		</button>
	</div>
{/if}

<section class="panel panel-flush">
	<div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border-subtle);">
		<FilterBar>
			<SearchInput bind:value={search} placeholder="Actor, action, resource…" label="" />
			<Select
				bind:value={resultFilter}
				label="Result"
				id="audit-result"
				allLabel="Any result"
				options={[
					{ value: 'SUCCESS', label: 'Success' },
					{ value: 'FAILURE', label: 'Failure' },
					{ value: 'DENIED', label: 'Denied' }
				]}
			/>
			<Select bind:value={tenantFilter} label="Tenant" id="audit-tenant" allLabel="All tenants" options={tenantOptions} />
		</FilterBar>
	</div>

	{#if !loading && filtered.length === 0 && logs.length > 0}
		<EmptyState title="No matching events" description="Try a different search or clear the filters.">
			{#snippet action()}
				<button type="button" class="btn btn-ghost btn-sm" onclick={clearFilters}>Clear filters</button>
			{/snippet}
		</EmptyState>
	{:else}
		<DataTable
			{loading}
			empty={!loading && filtered.length === 0}
			emptyTitle="No activity yet"
			emptyDescription="Audit events will appear here as the platform is used."
		>
			{#snippet head()}
				<th>Event</th>
				<th>Actor</th>
				<th>Tenant</th>
				<th>Result</th>
				<th>When</th>
				<th style="width:1%;"><span class="sr-only">Detail</span></th>
			{/snippet}
			{#each filtered as log (log.id)}
				<tr>
					<td>
						<strong style="font-weight:550;">{log.action.replaceAll('_', ' ')}</strong>
						<span class="muted" style="display:block;font-size:0.74rem;">
							{log.resource}{log.resource_id ? ` · ${log.resource_id}` : ''}
						</span>
					</td>
					<td>
						{log.actor}
						{#if log.actor_email}
							<span class="muted" style="display:block;font-size:0.74rem;">{log.actor_email}</span>
						{/if}
					</td>
					<td style="color:var(--text-2);">{log.tenant || '—'}</td>
					<td><StatusBadge status={String(log.result)} /></td>
					<td class="muted" style="white-space:nowrap;" title={formatDateTime(log.timestamp)}>
						{formatRelative(log.timestamp)}
					</td>
					<td>
						<button
							type="button"
							class="btn btn-ghost btn-sm"
							onclick={() => openDetail(log)}
						>
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
			<div><dt>Event</dt><dd style="font-weight:550;">{selected.action.replaceAll('_', ' ')}</dd></div>
			<div><dt>Timestamp</dt><dd>{formatDateTime(selected.timestamp)}</dd></div>
			<div><dt>Actor</dt><dd>{selected.actor}</dd></div>
			{#if selected.actor_email}
				<div><dt>Actor email</dt><dd class="mono">{selected.actor_email}</dd></div>
			{/if}
			<div><dt>Resource</dt><dd>{selected.resource}</dd></div>
			{#if selected.resource_id}
				<div><dt>Resource ID</dt><dd class="mono">{selected.resource_id}</dd></div>
			{/if}
			<div><dt>Tenant</dt><dd>{selected.tenant || '—'}</dd></div>
			<div><dt>Result</dt><dd><StatusBadge status={String(selected.result)} /></dd></div>
		</dl>

		{#if selected.metadata}
			<div style="margin-top:1.1rem;">
				<p class="field-label" style="margin:0 0 0.35rem;">Metadata</p>
				<pre class="code-block">{JSON.stringify(selected.metadata, null, 2)}</pre>
			</div>
		{/if}
	{/if}
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (detailOpen = false)}>Close</button>
	{/snippet}
</SlideOver>
