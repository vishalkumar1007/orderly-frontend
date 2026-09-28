<script lang="ts">
	import { onMount } from 'svelte';
	import Download from '@lucide/svelte/icons/download';
	import { errorMessage } from '$lib/admin/errors';
	import { formatDateTime, rupees } from '$lib/admin/format';
	import {
		fetchOrderHistory,
		type OrderHistoryPage,
		type OrderHistoryRow
	} from '$lib/tenant/historyApi';
	import DataTable from '$lib/components/admin/DataTable.svelte';
	import EmptyState from '$lib/components/admin/EmptyState.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import FilterBar from '$lib/components/admin/FilterBar.svelte';
	import Pagination from '$lib/components/admin/Pagination.svelte';
	import SearchInput from '$lib/components/admin/SearchInput.svelte';
	import Select from '$lib/components/admin/Select.svelte';
	import SlideOver from '$lib/components/admin/SlideOver.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import { toast } from '$lib/components/admin/toast';

	/**
	 * Order history.
	 *
	 * The Selling board is the present tense — a queue somebody is working.
	 * This is the record: every order the shop has ever taken, searchable by
	 * number, customer or date. Filtering happens on the server, so a shop with
	 * a year of trading behind it still answers in one page.
	 */

	const PAGE_SIZE = 25;

	let data = $state<OrderHistoryPage | null>(null);
	let loading = $state(true);
	let error = $state('');

	let search = $state('');
	let statusFilter = $state('');
	let sourceFilter = $state('');
	let fromDate = $state('');
	let toDate = $state('');
	let pageIndex = $state(0);

	let selected = $state<OrderHistoryRow | null>(null);
	let detailOpen = $state(false);

	/** Debounced so typing a customer name is not one request per keystroke. */
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	let appliedSearch = $state('');

	$effect(() => {
		const next = search.trim();
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			if (next !== appliedSearch) {
				appliedSearch = next;
				pageIndex = 0;
			}
		}, 300);
		return () => clearTimeout(searchTimer);
	});

	async function load() {
		loading = true;
		error = '';
		try {
			data = await fetchOrderHistory({
				q: appliedSearch || undefined,
				status: statusFilter || undefined,
				source: sourceFilter || undefined,
				from: fromDate || undefined,
				to: toDate || undefined,
				limit: PAGE_SIZE,
				offset: pageIndex * PAGE_SIZE
			});
		} catch (err) {
			error = errorMessage(err, 'load order history');
			data = null;
		} finally {
			loading = false;
		}
	}

	onMount(load);

	// Every filter change is a new server query, including paging.
	$effect(() => {
		appliedSearch;
		statusFilter;
		sourceFilter;
		fromDate;
		toDate;
		pageIndex;
		void load();
	});

	// Changing a filter returns to the first page, or the table can show an
	// empty page of results that do exist.
	$effect(() => {
		statusFilter;
		sourceFilter;
		fromDate;
		toDate;
		pageIndex = 0;
	});

	const orders = $derived(data?.orders ?? []);
	const total = $derived(data?.page.total ?? 0);
	const summary = $derived(data?.summary);
	const filtersActive = $derived(
		Boolean(appliedSearch || statusFilter || sourceFilter || fromDate || toDate)
	);

	function clearFilters() {
		search = '';
		appliedSearch = '';
		statusFilter = '';
		sourceFilter = '';
		fromDate = '';
		toDate = '';
		pageIndex = 0;
	}

	function openDetail(order: OrderHistoryRow) {
		selected = order;
		detailOpen = true;
	}

	/** Download the filtered page as CSV, for an accountant who asked. */
	function exportCsv() {
		if (orders.length === 0) return;
		const header = [
			'order_number',
			'placed_at',
			'status',
			'source',
			'customer_name',
			'customer_phone',
			'items',
			'total',
			'payment_status',
			'payment_method',
			'prep_minutes'
		];
		const rows = orders.map((o) => [
			o.order_number,
			o.created_at,
			o.status,
			o.source,
			o.customer_name,
			o.customer_phone,
			o.item_count,
			o.total,
			o.payment_status,
			o.payment_method,
			o.prep_minutes ?? ''
		]);
		const csv = [header, ...rows]
			// Quote every cell: a customer called "Smith, J" would otherwise
			// split into two columns.
			.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
			.join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `orders-page-${pageIndex + 1}.csv`;
		link.click();
		URL.revokeObjectURL(url);
		toast.success('This page exported as CSV');
	}
</script>

{#if error}
	<div class="panel" style="margin-bottom:0.85rem;"><ErrorState message={error} onretry={load} /></div>
{/if}

{#if summary}
	<div class="stat-row" style="margin-bottom:0.85rem;">
		<div class="stat">
			<span class="stat-label">Orders</span>
			<p class="stat-value">{summary.total_orders}</p>
			<p class="stat-hint">{filtersActive ? 'matching these filters' : 'all time'}</p>
		</div>
		<div class="stat">
			<span class="stat-label">Revenue</span>
			<p class="stat-value">{rupees(summary.total_revenue)}</p>
			<p class="stat-hint">Cancelled orders excluded</p>
		</div>
		<div class="stat">
			<span class="stat-label">Completed</span>
			<p class="stat-value">{summary.completed}</p>
			<p class="stat-hint">Collected by the customer</p>
		</div>
		<div class="stat">
			<span class="stat-label">Cancelled</span>
			<p class="stat-value">{summary.cancelled}</p>
			<p class="stat-hint">
				{summary.total_orders > 0
					? `${Math.round((summary.cancelled / summary.total_orders) * 100)}% of orders`
					: 'None'}
			</p>
		</div>
	</div>
{/if}

<section class="panel panel-flush">
	<div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border-subtle);">
		<FilterBar>
			<SearchInput bind:value={search} placeholder="Order number, name or phone…" label="" />
			<Select
				bind:value={statusFilter}
				label="Status"
				id="oh-status"
				allLabel="Any status"
				options={[
					{ value: 'PENDING', label: 'Pending' },
					{ value: 'ACCEPTED', label: 'Accepted' },
					{ value: 'PREPARING', label: 'Preparing' },
					{ value: 'READY', label: 'Ready' },
					{ value: 'COMPLETED', label: 'Completed' },
					{ value: 'CANCELLED', label: 'Cancelled' }
				]}
			/>
			<Select
				bind:value={sourceFilter}
				label="Placed by"
				id="oh-source"
				allLabel="Anyone"
				options={[
					{ value: 'GUEST', label: 'Guest' },
					{ value: 'CUSTOMER', label: 'Signed-in customer' },
					{ value: 'STAFF', label: 'Staff at the counter' }
				]}
			/>
			<div class="field">
				<label class="field-label" for="oh-from">From</label>
				<input class="input" id="oh-from" type="date" bind:value={fromDate} max={toDate || undefined} />
			</div>
			<div class="field">
				<label class="field-label" for="oh-to">To</label>
				<input class="input" id="oh-to" type="date" bind:value={toDate} min={fromDate || undefined} />
			</div>
		</FilterBar>

		<div class="hist-actions">
			{#if filtersActive}
				<button type="button" class="btn btn-quiet btn-sm" onclick={clearFilters}>
					Clear filters
				</button>
			{/if}
			<button
				type="button"
				class="btn btn-ghost btn-sm"
				disabled={orders.length === 0}
				onclick={exportCsv}
			>
				<Download size={13} strokeWidth={2} />
				Export this page
			</button>
		</div>
	</div>

	{#if !loading && orders.length === 0 && filtersActive}
		<EmptyState
			title="No orders match"
			description="Try a wider date range, or clear the filters to see everything."
		>
			{#snippet action()}
				<button type="button" class="btn btn-ghost btn-sm" onclick={clearFilters}>
					Clear filters
				</button>
			{/snippet}
		</EmptyState>
	{:else}
		<DataTable
			{loading}
			empty={!loading && orders.length === 0}
			emptyTitle="No orders yet"
			emptyDescription="Orders appear here as soon as customers start placing them."
		>
			{#snippet head()}
				<th>Order</th>
				<th class="col-sm">Customer</th>
				<th class="col-md">Items</th>
				<th>Total</th>
				<th>Status</th>
				<th class="col-md">Payment</th>
				<th class="col-md">Placed</th>
				<th style="width:1%;"><span class="sr-only">Detail</span></th>
			{/snippet}

			{#each orders as order (order.id)}
				<tr>
					<td>
						<strong style="font-weight:600;">#{order.order_number}</strong>
						{#if order.prep_minutes !== null}
							<span class="muted" style="display:block;font-size:0.72rem;">
								{order.prep_minutes} min to ready
							</span>
						{/if}
					</td>
					<td class="col-sm">
						{order.customer_name || 'Walk-in'}
						{#if order.customer_phone}
							<span class="muted" style="display:block;font-size:0.72rem;">
								{order.customer_phone}
							</span>
						{/if}
					</td>
					<td class="col-md muted">{order.item_count}</td>
					<td class="num" style="font-weight:550;">{rupees(order.total)}</td>
					<td><StatusBadge status={order.status} /></td>
					<td class="col-md">
						{#if order.payment_status}
							<StatusBadge status={order.payment_status} dot={false} />
							<span class="muted" style="display:block;font-size:0.72rem;">
								{order.payment_method || '—'}
							</span>
						{:else}
							<span class="muted">—</span>
						{/if}
					</td>
					<td class="muted col-md" style="white-space:nowrap;">
						{formatDateTime(order.created_at)}
					</td>
					<td>
						<button type="button" class="btn btn-ghost btn-sm" onclick={() => openDetail(order)}>
							Detail
						</button>
					</td>
				</tr>
			{/each}
		</DataTable>

		<Pagination bind:pageIndex {total} pageSize={PAGE_SIZE} noun="order" />
	{/if}
</section>

<SlideOver bind:open={detailOpen} title={selected ? `Order #${selected.order_number}` : 'Order'}>
	{#if selected}
		<dl class="dl">
			<div><dt>Status</dt><dd><StatusBadge status={selected.status} /></dd></div>
			<div><dt>Placed</dt><dd>{formatDateTime(selected.created_at)}</dd></div>
			<div>
				<dt>Placed by</dt>
				<dd style="text-transform:capitalize;">{selected.source.toLowerCase()}</dd>
			</div>
			<div><dt>Customer</dt><dd>{selected.customer_name || 'Walk-in'}</dd></div>
			{#if selected.customer_phone}
				<div><dt>Phone</dt><dd class="mono">{selected.customer_phone}</dd></div>
			{/if}
			<div><dt>Items</dt><dd>{selected.item_count}</dd></div>
			<div><dt>Total</dt><dd style="font-weight:600;">{rupees(selected.total)}</dd></div>
			<div>
				<dt>Payment</dt>
				<dd>
					{#if selected.payment_status}
						{selected.payment_status}{selected.payment_method ? ` · ${selected.payment_method}` : ''}
					{:else}
						Not recorded
					{/if}
				</dd>
			</div>
			{#if selected.prep_minutes !== null}
				<div><dt>Preparation</dt><dd>{selected.prep_minutes} minutes</dd></div>
			{/if}
			{#if selected.completed_at}
				<div><dt>Completed</dt><dd>{formatDateTime(selected.completed_at)}</dd></div>
			{/if}
			{#if selected.cancelled_at}
				<div><dt>Cancelled</dt><dd>{formatDateTime(selected.cancelled_at)}</dd></div>
			{/if}
			{#if selected.cancel_reason}
				<div><dt>Reason</dt><dd>{selected.cancel_reason}</dd></div>
			{/if}
		</dl>
	{/if}
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (detailOpen = false)}>Close</button>
	{/snippet}
</SlideOver>

<style>
	.hist-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
</style>
