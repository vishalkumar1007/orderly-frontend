<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import LogOut from '@lucide/svelte/icons/log-out';
	import { friendlyError, storefrontApi, type CustomerProfile } from '$lib/storefront/api';
	import { customerSession, customerToken } from '$lib/storefront/session.svelte';
	import { money, relativeTime } from '$lib/storefront/format';

	/**
	 * The customer profile.
	 *
	 * Deliberately small: who you are, what you have ordered, and a way out. The
	 * benefits list is honest about what sign-in does today rather than promising
	 * features that do not exist yet.
	 */
	let { data } = $props();

	const config = $derived(data.config);
	const currency = $derived(config?.store?.currency ?? 'INR');

	let profile = $state<CustomerProfile | null>(null);
	let loading = $state(true);
	let error = $state('');
	let signedIn = $state(false);
	let editing = $state(false);
	let name = $state('');
	let saving = $state(false);

	const token = $derived(customerToken(data.tenantSlug ?? ''));

	onMount(async () => {
		signedIn = Boolean(token);
		if (!token) {
			loading = false;
			return;
		}
		await load();
	});

	async function load() {
		loading = true;
		try {
			profile = await storefrontApi.profile(customerToken(data.tenantSlug ?? ''));
			name = profile?.customer.name ?? '';
		} catch (err) {
			error = friendlyError(err, 'Could not load your profile');
		} finally {
			loading = false;
		}
	}

	async function saveName(event: SubmitEvent) {
		event.preventDefault();
		if (name.trim().length < 2) {
			error = 'Name must be at least 2 characters';
			return;
		}
		saving = true;
		try {
			const updated = await storefrontApi.updateProfile(
				name.trim(),
				customerToken(data.tenantSlug ?? '')
			);
			profile = updated;
			customerSession.setCustomer(data.tenantSlug ?? '', {
				...(profile?.customer ?? ({} as never)),
				name: name.trim()
			} as never);
			editing = false;
			error = '';
		} catch (err) {
			error = friendlyError(err, 'Could not save your name');
		} finally {
			saving = false;
		}
	}

	function signOut() {
		customerSession.signOut(data.tenantSlug ?? '');
		signedIn = false;
		profile = null;
		void goto('/menu');
	}

	const activeOrders = $derived(profile?.active_orders ?? []);
	const pastOrders = $derived(profile?.recent_orders ?? []);
</script>

<div class="sf-wrap" style="padding-top:18px;">
	{#if loading}
		<div style="display:grid;gap:12px;">
			<div class="sf-skeleton" style="height:110px;border-radius:var(--sf-radius);"></div>
			<div class="sf-skeleton" style="height:180px;border-radius:var(--sf-radius);"></div>
		</div>
	{:else if !signedIn || !profile}
		<div class="sf-empty">
			<span class="sf-empty-icon" aria-hidden="true">
				<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
					<circle cx="12" cy="8" r="4" />
					<path d="M4 21a8 8 0 0 1 16 0" />
				</svg>
			</span>
			<h3>Sign in to see your profile</h3>
			<p>Your name, order history and live order tracking in one place.</p>
			<a class="sf-btn sf-btn-primary" href="/login?next=%2Fprofile">Sign in with phone</a>
			<a class="sf-btn sf-btn-ghost" style="margin-top:8px;" href="/orders">Find my orders</a>
		</div>
	{:else}
		<h1 style="margin:0 0 16px;font-size:var(--fs-stat);font-weight:800;letter-spacing:-0.02em;">
			Your profile
		</h1>

		{#if error}
			<div class="sf-alert" data-tone="error" role="alert" style="margin-bottom:14px;">
				<span>{error}</span>
			</div>
		{/if}

		<div class="sf-panel">
			{#if editing}
				<form onsubmit={saveName}>
					<label class="sf-field" style="margin-bottom:12px;">
						<span class="sf-label">Your name</span>
						<input class="sf-input" type="text" bind:value={name} autocomplete="name" maxlength="80" />
					</label>
					<div class="sf-btn-row">
						<button class="sf-btn sf-btn-secondary" type="button" onclick={() => (editing = false)}>
							Cancel
						</button>
						<button class="sf-btn sf-btn-primary" type="submit" disabled={saving}>
							{saving ? 'Saving…' : 'Save'}
						</button>
					</div>
				</form>
			{:else}
				<div style="display:flex;align-items:center;gap:12px;">
					<span
						style="width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:var(--sf-primary-soft);color:var(--sf-primary);font-weight:800;font-size:var(--fs-h1);flex-shrink:0;"
						aria-hidden="true"
					>
						{(profile.customer.name || 'G').trim().charAt(0).toUpperCase()}
					</span>
					<div style="flex:1;min-width:0;">
						<p style="margin:0;font-weight:700;font-size:var(--fs-title);">
							{profile.customer.name || 'Your name'}
						</p>
						<p style="margin:2px 0 0;font-size:var(--fs-body);color:var(--sf-text-2);">
							{profile.customer.phone}
						</p>
					</div>
					<button class="sf-btn sf-btn-sm sf-btn-secondary" type="button" onclick={() => (editing = true)}>
						Edit
					</button>
				</div>
			{/if}
		</div>

		<h2 class="sf-group-title">What signing in gives you</h2>
		<div class="sf-panel">
			<ul style="margin:0;padding-left:18px;display:grid;gap:6px;">
				{#each profile.benefits as benefit (benefit)}
					<li style="font-size:0.875rem;color:var(--sf-text-2);line-height:1.45;">{benefit}</li>
				{/each}
			</ul>
		</div>

		{#if activeOrders.length}
			<h2 class="sf-group-title">In progress</h2>
			<div style="display:grid;gap:10px;">
				{#each activeOrders as order (order.order_number)}
					<a class="sf-card" style="display:block;padding:14px;text-decoration:none;color:inherit;" href={'/order/' + order.order_number}>
						<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;">
							<strong style="font-size:0.9375rem;">{order.reference || '#' + order.order_number}</strong>
							<strong style="font-size:0.9375rem;">{money(order.total, currency)}</strong>
						</div>
						<div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
							<span class="sf-tag">{order.status_label}</span>
							<span style="font-size:0.75rem;color:var(--sf-text-3);">{relativeTime(order.created_at)}</span>
						</div>
					</a>
				{/each}
			</div>
		{/if}

		{#if pastOrders.length}
			<h2 class="sf-group-title">Past orders</h2>
			<div style="display:grid;gap:10px;">
				{#each pastOrders as order (order.order_number)}
					<a class="sf-card" style="display:block;padding:14px;text-decoration:none;color:inherit;" href={'/order/' + order.order_number}>
						<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;">
							<strong style="font-size:0.9375rem;">{order.reference || '#' + order.order_number}</strong>
							<strong style="font-size:0.9375rem;">{money(order.total, currency)}</strong>
						</div>
						<p style="margin:4px 0 0;font-size:var(--fs-body);color:var(--sf-text-2);">
							{order.item_count} {order.item_count === 1 ? 'item' : 'items'} · {relativeTime(order.created_at)}
						</p>
					</a>
				{/each}
			</div>
		{/if}

		<div style="margin-top:20px;display:grid;gap:10px;">
			<a class="sf-btn sf-btn-primary sf-btn-block" href="/menu">Order again</a>
			<button class="sf-btn sf-btn-secondary sf-btn-block" type="button" onclick={signOut}>
				<LogOut size={16} strokeWidth={2} aria-hidden="true" />
				Sign out
			</button>
		</div>
	{/if}
</div>
