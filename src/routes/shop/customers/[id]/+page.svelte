<script lang="ts">
	import { page } from '$app/state';
	import IconArrowLeft from '@tabler/icons-svelte/icons/arrow-left';
	import IconLogin from '@tabler/icons-svelte/icons/login';
	import IconReceipt from '@tabler/icons-svelte/icons/receipt';
	import IconCalendar from '@tabler/icons-svelte/icons/calendar-event';
	import IconBed from '@tabler/icons-svelte/icons/bed';
	import IconShield from '@tabler/icons-svelte/icons/shield';
	import { formatCurrency, formatDate, formatDateTime, formatRelative, initials } from '$lib/admin/format';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import { toast } from '$lib/components/admin/toast';
	import {
		getShopCustomer,
		getShopCustomerActivity,
		getShopGuestCustomer,
		setShopCustomerBlocked,
		type CustomerEvent,
		type ShopCustomerDetail
	} from '$lib/tenant/customersApi';
	import { orderingEnabled, terms } from '$lib/tenant/businessType.svelte';

	// "/shop/customers/guest?phone=..." lands here too: guests have no id and no activity feed.
	const id = $derived(page.params.id ?? '');
	const phone = $derived(page.url.searchParams.get('phone') ?? '');
	const isGuest = $derived(id === 'guest');

	let detail = $state<ShopCustomerDetail | null>(null);
	let loading = $state(true);
	let error = $state('');
	let blocking = $state(false);
	let tab = $state<'activity' | 'orders'>('activity');

	let events = $state<CustomerEvent[]>([]);
	let hasMore = $state(false);
	let evLoading = $state(false);
	let evError = $state('');

	async function loadEvents(more = false) {
		if (isGuest) return;
		const want = id;
		evLoading = true;
		evError = '';
		try {
			const r = await getShopCustomerActivity(want, more ? events.at(-1)?.at : undefined);
			if (want !== id) return;
			events = more ? [...events, ...r.events] : r.events;
			hasMore = r.has_more;
		} catch (err) {
			if (want === id) evError = err instanceof Error ? err.message : 'Failed to load activity';
		} finally {
			if (want === id) evLoading = false;
		}
	}

	$effect(() => {
		const key = id + phone;
		void key;
		let live = true;
		loading = true;
		error = '';
		detail = null;
		events = [];
		hasMore = false;
		tab = isGuest ? 'orders' : 'activity';
		(isGuest ? getShopGuestCustomer(phone) : getShopCustomer(id))
			.then((d) => live && (detail = d))
			.catch((e) => live && (error = e instanceof Error ? e.message : 'Could not load customer'))
			.finally(() => live && (loading = false));
		void loadEvents();
		return () => (live = false);
	});

	async function toggleBlock() {
		const c = detail?.customer;
		if (!c?.id) return;
		if (!c.is_blocked && !window.confirm(`Block ${c.name || c.phone || 'this customer'}? They will not be able to sign in or order.`))
			return;
		blocking = true;
		try {
			const u = await setShopCustomerBlocked(c.id, !c.is_blocked);
			detail = { ...detail!, customer: { ...c, is_blocked: u.is_blocked } };
			toast.success(u.is_blocked ? 'Customer blocked' : 'Customer unblocked');
			void loadEvents();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not update customer');
		} finally {
			blocking = false;
		}
	}

	const money = (n: number) => formatCurrency(n || 0);
	const title = (s: string) => {
		const t = s.replaceAll('_', ' ').toLowerCase();
		return t.charAt(0).toUpperCase() + t.slice(1);
	};

	function describe(e: CustomerEvent): string {
		const st = title(e.status || '');
		switch (e.kind) {
			case 'login':
				if (e.status === 'SUCCESS') return `Signed in with ${e.ref === 'EMAIL' ? 'email' : 'phone'} code`;
				return e.status === 'DENIED' ? 'Sign-in denied' : 'Sign-in failed';
			case 'order':
				return `${terms().order} #${e.ref} placed - ${st}${e.amount ? ` - ${money(e.amount)}` : ''}`;
			case 'appointment':
				return `Appointment for ${e.ref} - ${st}${e.detail ? ` - ${formatDateTime(e.detail)}` : ''}`;
			case 'stay':
				return `Stay ${formatDate(e.ref)} to ${formatDate(e.detail)} - ${st}`;
			default: {
				const what = e.status === 'customer.blocked' ? 'Blocked' : e.status === 'customer.unblocked' ? 'Unblocked' : title(e.status.replace('customer.', ''));
				return `${what}${e.ref ? ` by ${e.ref}` : ''}`;
			}
		}
	}
	const ICONS = { login: IconLogin, order: IconReceipt, appointment: IconCalendar, stay: IconBed, admin: IconShield };

	const showOrders = $derived(orderingEnabled() || (detail?.orders.length ?? 0) > 0);
	const tabs = $derived([
		...(isGuest ? [] : [{ id: 'activity' as const, label: 'Activity' }]),
		...(showOrders || isGuest ? [{ id: 'orders' as const, label: terms().orders }] : [])
	]);
	const c = $derived(detail?.customer);
</script>

<div class="cp">
	<a class="cp-back" href="/shop/customers"><IconArrowLeft size={16} /> Customers</a>

	{#if loading}
		<Skeleton height="6rem" />
		<Skeleton height="4.5rem" />
		<Skeleton height="12rem" />
	{:else if error || !detail || !c}
		<div class="panel cp-pad">
			<p class="muted">{error || 'Customer not found'}</p>
			<a class="btn btn-ghost btn-sm" href="/shop/customers">Back to customers</a>
		</div>
	{:else}
		<section class="panel cp-head">
			<span class="cell-avatar" style="width:3rem;height:3rem;font-size:var(--fs-title);">
				{initials(c.name || c.phone, '?')}
			</span>
			<div class="cp-id">
				<h2>
					{c.name || 'Unnamed customer'}
					{#if c.kind === 'guest'}<span class="badge badge-neutral badge-plain">Guest</span>{/if}
					{#if c.is_blocked}<StatusBadge status="BLOCKED" kind="danger" />{/if}
				</h2>
				<p class="muted">
					{c.phone || '-'}{c.email ? ` / ${c.email}` : ''}
				</p>
				<p class="muted">
					{#if c.created_at}Joined {formatDate(c.created_at)}{/if}{#if c.last_login_at}
						{c.created_at ? ' / ' : ''}Last login {formatRelative(c.last_login_at)}{/if}
				</p>
			</div>
			{#if c.id}
				<button
					type="button"
					class={['btn btn-sm', c.is_blocked ? 'btn-ghost' : 'btn-danger'].join(' ')}
					disabled={blocking}
					onclick={() => void toggleBlock()}
				>
					{c.is_blocked ? 'Unblock' : 'Block'}
				</button>
			{/if}
		</section>

		<div class="cp-tiles">
			<div class="panel"><span>{terms().orders}</span><strong>{detail.stats.order_count}</strong></div>
			<div class="panel"><span>Total spend</span><strong>{money(detail.stats.total_spend)}</strong></div>
			<div class="panel"><span>Average</span><strong>{money(detail.stats.average_order)}</strong></div>
			<div class="panel">
				<span>Last {terms().order.toLowerCase()}</span>
				<strong>{formatRelative(detail.stats.last_order_at)}</strong>
			</div>
		</div>

		<section class="panel panel-flush">
			<div class="cp-tabs" role="tablist" aria-label="Customer details">
				{#each tabs as t (t.id)}
					<button
						type="button"
						role="tab"
						id="tab-{t.id}"
						aria-selected={tab === t.id}
						aria-controls="panel-{t.id}"
						class="cp-tab"
						class:active={tab === t.id}
						onclick={() => (tab = t.id)}
					>
						{t.label}
					</button>
				{/each}
			</div>

			{#if tab === 'activity' && !isGuest}
				<div id="panel-activity" role="tabpanel" aria-labelledby="tab-activity" class="cp-pad">
					{#if evError}
						<p class="muted">{evError}</p>
						<button type="button" class="btn btn-ghost btn-sm" onclick={() => void loadEvents(events.length > 0)}>Retry</button>
					{:else if evLoading && events.length === 0}
						{#each [1, 2, 3] as i (i)}<Skeleton height="2rem" />{/each}
					{:else if events.length === 0}
						<p class="muted">No activity yet.</p>
					{:else}
						<ul class="cp-list">
							{#each events as e, i (e.at + e.kind + i)}
								{@const Icon = ICONS[e.kind] ?? IconShield}
								<li>
									<span class="cp-ico"><Icon size={15} /></span>
									<span class="cp-txt">
										{describe(e)}
										{#if e.kind === 'login' && e.detail}<small class="muted">{e.detail}</small>{/if}
									</span>
									<time class="muted" datetime={e.at} title={formatDateTime(e.at)}>{formatRelative(e.at)}</time>
								</li>
							{/each}
						</ul>
						{#if hasMore}
							<button type="button" class="btn btn-ghost btn-sm" disabled={evLoading} onclick={() => void loadEvents(true)}>
								{evLoading ? 'Loading...' : 'Load older'}
							</button>
						{/if}
					{/if}
				</div>
			{:else}
				<div id="panel-orders" role="tabpanel" aria-labelledby="tab-orders" class="cp-pad">
					{#if detail.orders.length === 0}
						<p class="muted">No {terms().orders.toLowerCase()} on file.</p>
					{:else}
						<ul class="cp-list">
							{#each detail.orders as o (o.id)}
								<li>
									<strong>#{o.order_number}</strong>
									<span class="cp-txt"><StatusBadge status={o.status} /></span>
									<span>{money(o.total)}</span>
									<time class="muted" datetime={o.created_at ?? ''}>{formatRelative(o.created_at)}</time>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
		</section>
	{/if}
</div>

<style>
	.cp {
		display: grid;
		gap: 1rem;
	}
	.cp-back {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--text-2);
		text-decoration: none;
		font-size: var(--fs-body);
		width: fit-content;
	}
	.cp-pad {
		padding: 1rem;
		display: grid;
		gap: 0.6rem;
		justify-items: start;
	}
	.cp-head {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 1rem;
		flex-wrap: wrap;
	}
	.cp-id {
		flex: 1;
		min-width: 12rem;
	}
	.cp-id h2 {
		margin: 0;
		font-size: var(--fs-title);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}
	.cp-id p {
		margin: 0.15rem 0 0;
		font-size: var(--fs-body);
		overflow-wrap: anywhere;
	}
	.cp-tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		gap: 0.75rem;
	}
	.cp-tiles .panel {
		padding: 0.75rem 1rem;
		display: grid;
		gap: 0.2rem;
	}
	.cp-tiles span {
		font-size: var(--fs-meta);
		color: var(--text-3);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 700;
	}
	.cp-tiles strong {
		font-size: var(--fs-title);
	}
	.cp-tabs {
		display: flex;
		gap: 0.25rem;
		padding: 0 0.75rem;
		border-bottom: 1px solid var(--border);
	}
	.cp-tab {
		background: none;
		border: 0;
		border-bottom: 2px solid transparent;
		padding: 0.7rem 0.75rem;
		font-weight: 650;
		color: var(--text-2);
		cursor: pointer;
	}
	.cp-tab.active {
		color: var(--text);
		border-bottom-color: var(--accent, #3b82f6);
	}
	.cp-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.1rem;
		width: 100%;
	}
	.cp-list li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--border);
		font-size: var(--fs-body);
	}
	.cp-txt {
		flex: 1;
		min-width: 0;
		display: grid;
		overflow-wrap: anywhere;
	}
	.cp-txt small {
		font-size: var(--fs-meta);
	}
	.cp-ico {
		display: grid;
		place-items: center;
		width: 1.7rem;
		height: 1.7rem;
		border-radius: 50%;
		background: var(--bg);
		border: 1px solid var(--border);
		flex: none;
	}
	time {
		font-size: var(--fs-meta);
		white-space: nowrap;
	}
</style>
