<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import Receipt from '@lucide/svelte/icons/receipt';
	import Search from '@lucide/svelte/icons/search';
	import { friendlyError, storefrontApi, type OrderSummary } from '$lib/storefront/api';
	import { customerToken } from '$lib/storefront/session.svelte';
	import { money, relativeTime } from '$lib/storefront/format';

	/**
	 * Order history.
	 *
	 * A signed-in customer sees their own orders with no extra step. A guest is
	 * asked for the phone number they ordered with, which is the same proof the
	 * tracking screen requires — a number on its own reveals nothing.
	 */
	let { data } = $props();

	const config = $derived(data.config);
	const currency = $derived(config?.store?.currency ?? 'INR');

	let orders = $state<OrderSummary[]>([]);
	let loading = $state(true);
	let error = $state('');
	let signedIn = $state(false);
	let phone = $state('');
	let looking = $state(false);

	onMount(async () => {
		const token = customerToken(data.tenantSlug ?? '');
		signedIn = Boolean(token);
		if (!token) {
			loading = false;
			return;
		}
		try {
			orders = (await storefrontApi.orders(token)).orders;
		} catch (err) {
			error = friendlyError(err, 'Could not load your orders');
		} finally {
			loading = false;
		}
	});

	async function lookup(event: SubmitEvent) {
		event.preventDefault();
		looking = true;
		error = '';
		try {
			orders = (await storefrontApi.lookupOrders(phone.trim())).orders;
		} catch (err) {
			error = friendlyError(err, 'Could not find orders for that number');
		} finally {
			looking = false;
		}
	}

	function trackPath(order: OrderSummary): string {
		return signedIn ? `/order/${order.order_number}` : `/order/${order.order_number}?phone=${encodeURIComponent(phone.trim())}`;
	}
</script>

<div class="sf-wrap" style="padding-top:18px;">
	<h1 style="margin:0 0 4px;font-size:var(--fs-stat);font-weight:800;letter-spacing:-0.02em;">Your orders</h1>
	<p style="margin:0 0 18px;font-size:var(--fs-title);color:var(--sf-text-2);">
		Track an order or start a new one.
	</p>

	{#if loading}
		<div style="display:grid;gap:10px;">
			{#each [1, 2, 3] as i (i)}
				<div class="sf-skeleton" style="height:92px;border-radius:var(--sf-radius);"></div>
			{/each}
		</div>
	{:else}
		{#if !signedIn}
			<div class="sf-panel" style="margin-bottom:16px;">
				<h2 style="margin:0 0 4px;font-size:var(--fs-title);">Find your orders</h2>
				<p style="margin:0 0 12px;font-size:var(--fs-body);color:var(--sf-text-2);line-height:1.45;">
					Enter the phone number you ordered with.
				</p>
				<form onsubmit={lookup} novalidate>
					<label class="sf-field" style="margin-bottom:10px;">
						<span class="sf-label">Phone number</span>
						<input
							class="sf-input"
							type="tel"
							inputmode="tel"
							bind:value={phone}
							autocomplete="tel"
							enterkeyhint="search"
							placeholder="98765 43210"
						/>
					</label>
					<button class="sf-btn sf-btn-secondary sf-btn-block" type="submit" disabled={looking}>
						<Search size={16} strokeWidth={2} aria-hidden="true" />
						{looking ? 'Looking…' : 'Find my orders'}
					</button>
				</form>
				<p style="margin:12px 0 0;font-size:var(--fs-body);color:var(--sf-text-2);line-height:1.45;">
					Signing in shows your orders without typing anything.
				</p>
				<a
					class="sf-btn sf-btn-ghost sf-btn-block"
					style="margin-top:8px;"
					href="/login?next=%2Forders"
				>
					Sign in with phone
				</a>
			</div>
		{/if}

		{#if error}
			<div class="sf-alert" data-tone="error" role="alert" style="margin-bottom:14px;">
				<span>{error}</span>
			</div>
		{/if}

		{#if orders.length === 0}
			<div class="sf-empty">
				<span class="sf-empty-icon" aria-hidden="true">
					<Receipt size={26} strokeWidth={1.7} />
				</span>
				<h3>{signedIn ? 'No orders yet' : 'No orders found'}</h3>
				<p>
					{signedIn
						? 'Your orders will appear here once you place one.'
						: 'We could not find an order for that number.'}
				</p>
				<a class="sf-btn sf-btn-primary" href="/menu">Browse the menu</a>
			</div>
		{:else}
			<div style="display:grid;gap:10px;">
				{#each orders as order (order.order_number)}
					<a
						class="sf-card"
						style="display:block;padding:14px;text-decoration:none;color:inherit;"
						href={trackPath(order)}
					>
						<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;">
							<strong style="font-size:0.9375rem;">
								{order.reference || '#' + order.order_number}
							</strong>
							<strong style="font-size:0.9375rem;font-variant-numeric:tabular-nums;">
								{money(order.total, currency)}
							</strong>
						</div>
						<p style="margin:4px 0 0;font-size:var(--fs-body);color:var(--sf-text-2);">
							{order.item_count} {order.item_count === 1 ? 'item' : 'items'} ·{' '}
							{order.items.slice(0, 2).map((i) => i.name).join(', ')}
							{order.items.length > 2 ? ` +${order.items.length - 2} more` : ''}
						</p>
						<div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
							<span
								class="sf-tag"
								data-tone={order.is_active ? undefined : 'veg'}
							>
								{order.status_label}
							</span>
							<span style="font-size:0.75rem;color:var(--sf-text-3);">
								{relativeTime(order.created_at)}
							</span>
						</div>
					</a>
				{/each}
			</div>
		{/if}

		<div style="margin-top:18px;">
			<a class="sf-btn sf-btn-primary sf-btn-block" href="/menu" onclick={() => goto('/menu')}>
				Start a new order
			</a>
		</div>
	{/if}
</div>
