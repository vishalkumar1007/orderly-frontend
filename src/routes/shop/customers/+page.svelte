<script lang="ts">
	import { onMount } from 'svelte';
	import Users from '@lucide/svelte/icons/users';
	import { formatRelative, initials } from '$lib/admin/format';
	import DataTable from '$lib/components/admin/DataTable.svelte';
	import SearchInput from '$lib/components/admin/SearchInput.svelte';
	import SlideOver from '$lib/components/admin/SlideOver.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import { toast } from '$lib/components/admin/toast';
	import {
		getShopCustomer,
		getShopGuestCustomer,
		listShopCustomers,
		setShopCustomerBlocked,
		type ShopCustomer,
		type ShopCustomerDetail
	} from '$lib/tenant/customersApi';

	let customers = $state<ShopCustomer[]>([]);
	let counts = $state({ registered: 0, guest: 0, total: 0 });
	let loading = $state(true);
	let query = $state('');
	let filter = $state<'all' | 'registered' | 'guest'>('all');

	let detailOpen = $state(false);
	let detailLoading = $state(false);
	let detail = $state<ShopCustomerDetail | null>(null);
	let blocking = $state(false);

	const visible = $derived(
		customers.filter((c) => (filter === 'all' ? true : c.kind === filter))
	);

	async function load() {
		loading = true;
		try {
			const data = await listShopCustomers(query);
			customers = data.customers ?? [];
			counts = data.counts ?? { registered: 0, guest: 0, total: 0 };
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to load customers');
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		void load();
	});

	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	let searchReady = false;
	$effect(() => {
		const q = query;
		if (!searchReady) {
			searchReady = true;
			return;
		}
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			void load();
		}, 250);
		return () => clearTimeout(searchTimer);
	});

	async function openCustomer(c: ShopCustomer) {
		detailOpen = true;
		detailLoading = true;
		detail = null;
		try {
			detail =
				c.kind === 'registered' && c.id
					? await getShopCustomer(c.id)
					: await getShopGuestCustomer(c.phone);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not load customer');
			detailOpen = false;
		} finally {
			detailLoading = false;
		}
	}

	async function toggleBlock() {
		const c = detail?.customer;
		if (!c?.id) return;
		blocking = true;
		try {
			const updated = await setShopCustomerBlocked(c.id, !c.is_blocked);
			detail = {
				...detail!,
				customer: { ...c, is_blocked: updated.is_blocked }
			};
			customers = customers.map((row) =>
				row.id === c.id ? { ...row, is_blocked: updated.is_blocked } : row
			);
			toast.success(updated.is_blocked ? 'Customer blocked' : 'Customer unblocked');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not update customer');
		} finally {
			blocking = false;
		}
	}

	function money(n: number) {
		return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
	}
</script>

<div class="cust-page">
	<header class="cust-head">
		<div>
			<p class="muted cust-lead">
				People who order from your shop — registered accounts and walk-in guests.
			</p>
			<div class="cust-stats">
				<span><strong>{counts.total}</strong> total</span>
				<span><strong>{counts.registered}</strong> registered</span>
				<span><strong>{counts.guest}</strong> guests</span>
			</div>
		</div>
	</header>

	<div class="cust-toolbar">
		<div class="cust-search">
			<SearchInput bind:value={query} placeholder="Search name or phone…" label="" id="cust-search" />
		</div>
		<div class="cust-filters" role="tablist" aria-label="Customer type">
			{#each [
				{ id: 'all', label: 'All' },
				{ id: 'registered', label: 'Registered' },
				{ id: 'guest', label: 'Guests' }
			] as f}
				<button
					type="button"
					class={['cust-filter', filter === f.id ? 'active' : ''].join(' ')}
					onclick={() => (filter = f.id as typeof filter)}
				>
					{f.label}
				</button>
			{/each}
		</div>
	</div>

	<section class="panel panel-flush">
		<DataTable
			{loading}
			empty={!loading && visible.length === 0}
			emptyTitle="No customers yet"
			emptyDescription="Customers appear here when someone places an order or signs in with their phone."
		>
			{#snippet head()}
				<th>Customer</th>
				<th>Type</th>
				<th>Orders</th>
				<th>Spend</th>
				<th>Last order</th>
				<th>Status</th>
			{/snippet}
			{#each visible as c (c.id ?? c.phone)}
				<tr class="cust-row" onclick={() => void openCustomer(c)}>
					<td>
						<div class="cell-id">
							<span class="cell-avatar" style="width:1.9rem;height:1.9rem;font-size:var(--fs-meta);">
								{#if c.name}
									{initials(c.name)}
								{:else}
									<Users size={12} />
								{/if}
							</span>
							<span class="cell-id-txt">
								<strong>{c.name || 'Guest'}</strong>
								<span style="font-family:var(--font);">{c.phone || '—'}</span>
							</span>
						</div>
					</td>
					<td style="color:var(--text-2);">
						{c.kind === 'registered' ? 'Registered' : 'Guest'}
					</td>
					<td>{c.order_count}</td>
					<td>{money(c.total_spend)}</td>
					<td class="muted">
						{c.last_order_at ? formatRelative(c.last_order_at) : '—'}
					</td>
					<td>
						{#if c.is_blocked}
							<StatusBadge status="BLOCKED" kind="danger" />
						{:else}
							<StatusBadge status="ACTIVE" />
						{/if}
					</td>
				</tr>
			{/each}
		</DataTable>
	</section>
</div>

<SlideOver
	bind:open={detailOpen}
	title={detail?.customer.name || detail?.customer.phone || 'Customer'}
>
	{#if detailLoading}
		<p class="muted">Loading…</p>
	{:else if detail}
		{@const c = detail.customer}
		<div class="cdetail">
			<section class="cdetail-block">
				<div class="cdetail-hero">
					<span class="cell-avatar" style="width:2.6rem;height:2.6rem;font-size:var(--fs-body);">
						{initials(c.name || c.phone || '?')}
					</span>
					<div>
						<strong>{c.name || 'Guest'}</strong>
						<p class="muted">{c.phone || 'No phone'}</p>
					</div>
				</div>
				<div class="cdetail-meta">
					<span>
						<strong>{c.order_count ?? detail.orders.length}</strong>
						orders
					</span>
					<span>
						<strong>{money(c.total_spend ?? 0)}</strong>
						spent
					</span>
					<span>
						{c.kind === 'registered' ? 'Registered' : 'Guest'}
					</span>
					{#if c.is_blocked}
						<StatusBadge status="BLOCKED" kind="danger" />
					{/if}
				</div>
				{#if c.kind === 'registered' && c.id}
					<button
						type="button"
						class="btn btn-ghost btn-sm"
						disabled={blocking}
						onclick={() => void toggleBlock()}
					>
						{c.is_blocked ? 'Unblock customer' : 'Block customer'}
					</button>
				{/if}
			</section>

			<section class="cdetail-block">
				<h4>Order history</h4>
				{#if detail.orders.length === 0}
					<p class="muted">No orders on file.</p>
				{:else}
					<ul class="cdetail-orders">
						{#each detail.orders as order (order.id)}
							<li>
								<a href="/shop/orders">
									<span>#{order.order_number}</span>
									<span class="muted">{order.status}</span>
									<span>{money(order.total)}</span>
									<span class="muted">
										{order.created_at ? formatRelative(order.created_at) : ''}
									</span>
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		</div>
	{/if}
</SlideOver>

<style>
	.cust-page {
		display: grid;
		gap: 1rem;
	}

	.cust-head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 1rem;
	}

	.cust-lead {
		margin: 0 0 0.45rem;
		font-size: var(--fs-body);
		line-height: 1.45;
	}

	.cust-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		font-size: var(--fs-body);
		color: var(--text-2);
	}

	.cust-stats strong {
		color: var(--text);
		font-weight: 750;
		margin-right: 0.15rem;
	}

	.cust-toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
		justify-content: space-between;
	}

	.cust-search {
		flex: 1;
		min-width: 14rem;
		max-width: 24rem;
	}

	.cust-filters {
		display: flex;
		gap: 0.35rem;
	}

	.cust-filter {
		border: 1px solid var(--border);
		background: var(--bg);
		border-radius: 999px;
		padding: 0.3rem 0.7rem;
		font-size: var(--fs-code);
		font-weight: 650;
		cursor: pointer;
		color: var(--text);
	}

	.cust-filter.active {
		border-color: color-mix(in srgb, var(--accent, #3b82f6) 45%, var(--border));
		background: color-mix(in srgb, var(--accent, #3b82f6) 12%, var(--surface));
	}

	.cust-row {
		cursor: pointer;
	}

	.cust-row:hover {
		background: color-mix(in srgb, var(--accent, #3b82f6) 5%, transparent);
	}

	.cdetail {
		display: grid;
		gap: 1.15rem;
	}

	.cdetail-hero {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.cdetail-hero strong {
		display: block;
		font-size: var(--fs-title);
	}

	.cdetail-hero p {
		margin: 0.15rem 0 0;
		font-size: var(--fs-body);
	}

	.cdetail-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
		font-size: var(--fs-body);
		color: var(--text-2);
	}

	.cdetail-meta strong {
		color: var(--text);
		margin-right: 0.2rem;
	}

	.cdetail-block h4 {
		margin: 0 0 0.55rem;
		font-size: var(--fs-meta);
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-3);
	}

	.cdetail-orders {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.35rem;
	}

	.cdetail-orders a {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		gap: 0.55rem;
		padding: 0.55rem 0.65rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		text-decoration: none;
		color: var(--text);
		font-size: var(--fs-body);
		align-items: center;
	}

	.cdetail-orders a:hover {
		border-color: color-mix(in srgb, var(--accent, #3b82f6) 40%, var(--border));
	}
</style>
