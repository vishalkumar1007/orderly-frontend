<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import ArrowLeft from '@tabler/icons-svelte/icons/arrow-left';
	import CircleCheck from '@tabler/icons-svelte/icons/circle-check';
	import { friendlyError, storefrontApi, type CustomerReservation } from '$lib/storefront/api';
	import { experienceFor } from '$lib/storefront/experience';
	import { bookingStatus, dayLabel, nights } from '$lib/storefront/booking';
	import { formatPhone, money } from '$lib/storefront/format';
	import { customerToken } from '$lib/storefront/session.svelte';

	/** One stay: dates, room, price, and cancelling it before check-in day. */
	let { data } = $props();

	const config = $derived(data.config!);
	const exp = $derived(experienceFor(config));
	const tz = $derived(config.hours?.timezone || 'Asia/Kolkata');
	const currency = $derived(config.store.currency ?? 'INR');
	const id = $derived($page.params.id);
	const isNew = $derived($page.url.searchParams.get('new') === '1');
	const tel = $derived(config.store.phone ? 'tel:' + config.store.phone.replace(/[^\d+]/g, '') : '');

	let res = $state<CustomerReservation | null>(null);
	let loading = $state(true);
	let error = $state('');
	let busy = $state(false);
	let confirming = $state(false);

	const token = () => customerToken(data.tenantSlug ?? '');

	onMount(async () => {
		const t = token();
		if (!t) {
			error = 'Sign in to see this reservation.';
			loading = false;
			return;
		}
		try {
			res = (await storefrontApi.reservations(t)).reservations.find((r) => r.id === id) ?? null;
			if (!res) error = 'We could not find this reservation.';
		} catch (err) {
			error = friendlyError(err, 'Could not load this reservation.');
		} finally {
			loading = false;
		}
	});

	async function cancel() {
		if (!res) return;
		busy = true;
		error = '';
		try {
			res = await storefrontApi.cancelReservation(res.id, token());
			confirming = false;
		} catch (err) {
			error = friendlyError(err, 'Could not cancel. Try again.');
		} finally {
			busy = false;
		}
	}

	const n = $derived(res ? nights(res.check_in, res.check_out) : 0);
</script>

<svelte:head><title>Reservation | {config.store.name}</title></svelte:head>

<div class="rv">
	<a class="rv-back" href="/reservations"><ArrowLeft size={18} stroke={1.8} aria-hidden="true" />Your reservations</a>

	{#if loading}
		<div class="rv-skel" aria-hidden="true"></div>
	{:else if !res}
		<p class="rv-error" role="alert">{error}</p>
		{#if error.startsWith('Sign in')}<a class="rv-btn" href={`/login?next=${encodeURIComponent($page.url.pathname)}`}>Sign in</a>{/if}
	{:else}
		{#if isNew && res.status === 'REQUESTED'}
			<p class="rv-done" role="status">
				<CircleCheck size={20} stroke={1.8} aria-hidden="true" />
				Reserved. {config.store.name} will confirm shortly.
			</p>
		{/if}

		<h1>{res.room_type_name}</h1>
		<p class="rv-when">{dayLabel(tz, res.check_in)} to {dayLabel(tz, res.check_out)}</p>

		<dl class="rv-facts">
			<div><dt>Status</dt><dd data-status={res.status}>{bookingStatus(res.status)}</dd></div>
			<div><dt>Stay</dt><dd>{n} {n === 1 ? 'night' : 'nights'}, {res.guests} {res.guests === 1 ? 'guest' : 'guests'}</dd></div>
			{#if res.total_amount !== null}<div><dt>Total</dt><dd>{money(res.total_amount, currency)}, {exp.words.payAtVenue.toLowerCase()}</dd></div>{/if}
			{#if res.notes}<div><dt>Requests</dt><dd class="rv-notes">{res.notes}</dd></div>{/if}
		</dl>

		{#if error}<p class="rv-error" role="alert">{error}</p>{/if}

		{#if confirming}
			<div class="rv-actions" role="group" aria-label="Cancel this reservation">
				<p>Cancel this reservation? The room goes back on sale for these dates.</p>
				<button class="rv-danger" type="button" disabled={busy} onclick={cancel}>Yes, cancel it</button>
				<button class="rv-quiet" type="button" onclick={() => (confirming = false)}>Keep it</button>
			</div>
		{:else if res.can_cancel}
			<div class="rv-actions">
				<button class="rv-quiet" type="button" onclick={() => (confirming = true)}>Cancel reservation</button>
			</div>
		{:else if res.status === 'REQUESTED' || res.status === 'CONFIRMED'}
			<p class="rv-note">Changes on the day of arrival go through the front desk.{#if tel} Call <a href={tel}>{formatPhone(config.store.phone)}</a>.{/if}</p>
		{/if}
	{/if}
</div>

<style>
	.rv {
		width: 100%;
		max-width: var(--sf-maxw);
		margin: 0 auto;
		padding: 16px var(--sf-gutter, 16px) 48px;
		color: var(--sf-text);
	}
	.rv-back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--sf-text-2);
		font-size: 14.5px;
		font-weight: 500;
		text-decoration: none;
	}
	.rv-done {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 16px 0 0;
		padding: 12px 14px;
		border-radius: var(--sf-radius-sm);
		background: var(--sf-success-soft);
		color: var(--sf-success);
		font-weight: 600;
	}
	h1 {
		margin: 20px 0 0;
		font-family: var(--sf-font-display, var(--sf-font));
		font-size: clamp(26px, 6vw, 34px);
		font-weight: 800;
		letter-spacing: -0.02em;
	}
	.rv-when {
		margin: 4px 0 0;
		font-size: 18px;
		font-weight: 600;
		color: var(--sf-text-2);
	}
	.rv-facts {
		margin: 20px 0 0;
	}
	.rv-facts > div {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		padding: 12px 0;
		border-bottom: 1px solid var(--sf-border);
		font-size: 15px;
	}
	.rv-facts dt {
		color: var(--sf-text-2);
	}
	.rv-facts dd {
		margin: 0;
		text-align: right;
		font-weight: 500;
	}
	dd[data-status='CONFIRMED'] {
		color: var(--sf-success);
	}
	.rv-notes {
		white-space: pre-line;
	}
	.rv-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		margin-top: 24px;
	}
	.rv-actions p {
		flex-basis: 100%;
		margin: 0;
	}
	.rv-btn,
	.rv-danger,
	.rv-quiet {
		display: inline-flex;
		align-items: center;
		height: 44px;
		padding: 0 18px;
		border-radius: var(--sf-btn-radius, 10px);
		font: inherit;
		font-weight: 650;
		text-decoration: none;
		cursor: pointer;
	}
	.rv-btn {
		border: 0;
		background: var(--sf-primary);
		color: var(--sf-primary-ink);
	}
	.rv-danger {
		border: 0;
		background: var(--sf-danger);
		color: #fff;
	}
	.rv-quiet {
		border: 1px solid var(--sf-border-strong);
		background: var(--sf-surface);
		color: var(--sf-text);
	}
	.rv-btn:focus-visible,
	.rv-danger:focus-visible,
	.rv-quiet:focus-visible,
	.rv-back:focus-visible {
		outline: 2px solid var(--sf-primary);
		outline-offset: 2px;
	}
	.rv-error {
		margin: 16px 0;
		color: var(--sf-danger);
	}
	.rv-note {
		margin-top: 24px;
		color: var(--sf-text-2);
	}
	.rv-note a {
		color: var(--sf-primary);
		font-weight: 600;
	}
	.rv-skel {
		height: 200px;
		margin-top: 20px;
		border-radius: var(--sf-radius);
		background: var(--sf-surface-2);
	}
</style>
