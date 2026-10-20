<script lang="ts">
	import { onMount } from 'svelte';
	import { formatCurrency, formatRelative, initials } from '$lib/admin/format';
	import SearchInput from '$lib/components/admin/SearchInput.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import { toast } from '$lib/components/admin/toast';
	import { listShopCustomers, type ShopCustomer } from '$lib/tenant/customersApi';
	import { terms } from '$lib/tenant/businessType.svelte';

	const PAGE = 50;
	let customers = $state<ShopCustomer[]>([]);
	let counts = $state({ registered: 0, guest: 0, total: 0 });
	let hasMore = $state(false);
	let loading = $state(true);
	let loadingMore = $state(false);
	let error = $state('');
	let query = $state('');
	let seq = 0;

	async function load(more = false) {
		const my = ++seq;
		error = '';
		if (more) loadingMore = true;
		else loading = true;
		try {
			const data = await listShopCustomers(query, more ? customers.length : 0, PAGE);
			if (my !== seq) return;
			customers = more ? [...customers, ...(data.customers ?? [])] : (data.customers ?? []);
			counts = data.counts ?? counts;
			hasMore = !!data.has_more;
		} catch (err) {
			if (my !== seq) return;
			error = err instanceof Error ? err.message : 'Failed to load customers';
			if (more) toast.error(error);
		} finally {
			if (my === seq) loading = loadingMore = false;
		}
	}

	onMount(() => void load());

	let timer: ReturnType<typeof setTimeout> | undefined;
	let ready = false;
	$effect(() => {
		void query;
		if (!ready) {
			ready = true;
			return;
		}
		clearTimeout(timer);
		timer = setTimeout(() => void load(), 300);
		return () => clearTimeout(timer);
	});

	const href = (c: ShopCustomer) =>
		c.kind === 'registered' && c.id
			? `/shop/customers/${c.id}`
			: `/shop/customers/guest?phone=${encodeURIComponent(c.phone)}`;
</script>

<div class="cust-page">
	<header>
		<p class="muted cust-lead">
			People who {terms().order.toLowerCase()} from you: registered accounts and guests.
		</p>
		<div class="cust-stats">
			<span><strong>{counts.total}</strong> total</span>
			<span><strong>{counts.registered}</strong> registered</span>
			<span><strong>{counts.guest}</strong> guests</span>
		</div>
	</header>

	<div class="cust-search">
		<SearchInput bind:value={query} placeholder="Search name, phone or email" label="" id="cust-search" />
	</div>

	<section class="panel panel-flush">
		{#if loading}
			<div class="cust-pad">
				{#each [1, 2, 3, 4, 5] as i (i)}<Skeleton height="2.4rem" />{/each}
			</div>
		{:else if error && customers.length === 0}
			<div class="cust-pad">
				<p class="muted">{error}</p>
				<button type="button" class="btn btn-ghost btn-sm" onclick={() => void load()}>Retry</button>
			</div>
		{:else if customers.length === 0}
			<div class="cust-pad">
				<strong>{query.trim() ? 'No matches' : 'No customers yet'}</strong>
				<p class="muted">
					{query.trim()
						? 'Try a different name, phone or email.'
						: 'Customers appear here when someone places an order or signs in.'}
				</p>
			</div>
		{:else}
			<div class="cust-grid cust-headrow" aria-hidden="true">
				<span>Customer</span><span>Contact</span><span>{terms().orders}</span><span>Spend</span>
				<span>Last {terms().order.toLowerCase()}</span><span>Last login</span>
			</div>
			{#each customers as c (c.id ?? c.phone)}
				<a class="cust-grid cust-row" href={href(c)}>
					<span class="cust-who">
						<span class="cell-avatar" style="width:1.9rem;height:1.9rem;font-size:var(--fs-meta);">
							{initials(c.name || c.phone, '?')}
						</span>
						<span class="cust-name">
							<strong>{c.name || 'Unnamed customer'}</strong>
							{#if c.kind === 'guest'}<span class="badge badge-neutral badge-plain">Guest</span>{/if}
							{#if c.is_blocked}<span class="badge badge-danger badge-plain">Blocked</span>{/if}
						</span>
					</span>
					<span class="cust-contact">{c.phone || c.email || '-'}</span>
					<span data-l={terms().orders}>{c.order_count}</span>
					<span data-l="Spend">{formatCurrency(c.total_spend || 0)}</span>
					<span class="muted" data-l="Last {terms().order.toLowerCase()}">
						{formatRelative(c.last_order_at)}
					</span>
					<span class="muted" data-l="Last login">{formatRelative(c.last_login_at)}</span>
				</a>
			{/each}
			{#if hasMore}
				<div class="cust-pad">
					<button
						type="button"
						class="btn btn-ghost btn-sm"
						disabled={loadingMore}
						onclick={() => void load(true)}
					>
						{loadingMore ? 'Loading...' : 'Load more'}
					</button>
				</div>
			{/if}
		{/if}
	</section>
</div>

<style>
	.cust-page {
		display: grid;
		gap: 1rem;
	}
	.cust-lead {
		margin: 0 0 0.45rem;
		font-size: var(--fs-body);
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
	}
	.cust-search {
		max-width: 24rem;
	}
	.cust-pad {
		padding: 1rem;
		display: grid;
		gap: 0.5rem;
		justify-items: start;
	}
	.cust-pad :global(.skeleton) {
		width: 100%;
	}
	.cust-grid {
		display: grid;
		grid-template-columns: minmax(0, 2.2fr) minmax(0, 1.5fr) 4rem 6rem 6.5rem 6.5rem;
		gap: 0.75rem;
		align-items: center;
		padding: 0.65rem 1rem;
		border-bottom: 1px solid var(--border);
		font-size: var(--fs-body);
	}
	.cust-headrow {
		font-size: var(--fs-meta);
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-3);
	}
	.cust-row {
		color: var(--text);
		text-decoration: none;
	}
	.cust-row:hover,
	.cust-row:focus-visible {
		background: color-mix(in srgb, var(--accent, #3b82f6) 5%, transparent);
	}
	.cust-who {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-width: 0;
	}
	.cust-name {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
		min-width: 0;
	}
	.cust-contact {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text-2);
	}
	@media (max-width: 720px) {
		.cust-headrow {
			display: none;
		}
		.cust-grid {
			grid-template-columns: 1fr 1fr;
			gap: 0.35rem 0.75rem;
		}
		.cust-who,
		.cust-contact {
			grid-column: 1 / -1;
		}
		.cust-row > [data-l]::before {
			content: attr(data-l) ': ';
			color: var(--text-3);
		}
	}
</style>
