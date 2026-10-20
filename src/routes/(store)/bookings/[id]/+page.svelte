<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import ArrowLeft from '@tabler/icons-svelte/icons/arrow-left';
	import CircleCheck from '@tabler/icons-svelte/icons/circle-check';
	import { ApiClientError } from '$lib/api/client';
	import { friendlyError, storefrontApi, type CustomerAppointment, type StoreSlot } from '$lib/storefront/api';
	import { experienceFor } from '$lib/storefront/experience';
	import { bookingStatus, clockIn, dayLabel, duration } from '$lib/storefront/booking';
	import { formatPhone, money } from '$lib/storefront/format';
	import { customerToken } from '$lib/storefront/session.svelte';
	import SlotPicker from '$lib/storefront/SlotPicker.svelte';

	/** One booking: when and with whom, and the two things a customer may do with it. */
	let { data } = $props();

	const config = $derived(data.config!);
	const exp = $derived(experienceFor(config));
	const tz = $derived(config.hours?.timezone || 'Asia/Kolkata');
	const currency = $derived(config.store.currency ?? 'INR');
	const id = $derived($page.params.id);
	const isNew = $derived($page.url.searchParams.get('new') === '1');
	const tel = $derived(config.store.phone ? 'tel:' + config.store.phone.replace(/[^\d+]/g, '') : '');

	let appt = $state<CustomerAppointment | null>(null);
	let loading = $state(true);
	let error = $state('');
	let busy = $state(false);
	let confirmingCancel = $state(false);
	let moving = $state(false);
	let moveDate = $state('');
	let moveTo = $state<StoreSlot | null>(null);
	let reload = $state(0);

	const token = () => customerToken(data.tenantSlug ?? '');

	onMount(async () => {
		const t = token();
		if (!t) {
			error = 'Sign in to see this booking.';
			loading = false;
			return;
		}
		try {
			appt = (await storefrontApi.appointments(t)).appointments.find((a) => a.id === id) ?? null;
			if (!appt) error = 'We could not find this booking.';
		} catch (err) {
			error = friendlyError(err, 'Could not load this booking.');
		} finally {
			loading = false;
		}
	});

	async function cancel() {
		if (!appt) return;
		busy = true;
		error = '';
		try {
			appt = await storefrontApi.cancelAppointment(appt.id, token());
			confirmingCancel = false;
		} catch (err) {
			error = friendlyError(err, 'Could not cancel. Try again.');
		} finally {
			busy = false;
		}
	}

	async function move() {
		if (!appt || !moveTo) return;
		busy = true;
		error = '';
		try {
			appt = await storefrontApi.rescheduleAppointment(appt.id, { start: moveTo.start, staff_id: appt.staff_id }, token());
			moving = false;
			moveTo = null;
		} catch (err) {
			if (err instanceof ApiClientError && err.code === 'slot_taken') {
				moveTo = null;
				reload++;
			}
			error = friendlyError(err, 'Could not change the time. Try again.');
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Booking | {config.store.name}</title></svelte:head>

<div class="bd">
	<a class="bd-back" href="/bookings"><ArrowLeft size={18} stroke={1.8} aria-hidden="true" />Your bookings</a>

	{#if loading}
		<div class="bd-skel" aria-hidden="true"></div>
	{:else if !appt}
		<p class="bd-error" role="alert">{error}</p>
		{#if error.startsWith('Sign in')}<a class="bd-btn" href={`/login?next=${encodeURIComponent($page.url.pathname)}`}>Sign in</a>{/if}
	{:else}
		{#if isNew && appt.status === 'REQUESTED'}
			<p class="bd-done" role="status">
				<CircleCheck size={20} stroke={1.8} aria-hidden="true" />
				You are booked. {config.store.name} will confirm shortly.
			</p>
		{/if}

		<h1>{appt.service_name}</h1>
		<p class="bd-when">{dayLabel(tz, appt.scheduled_at)} at {clockIn(tz, appt.scheduled_at)}</p>

		<dl class="bd-facts">
			<div><dt>Status</dt><dd data-status={appt.status}>{bookingStatus(appt.status)}</dd></div>
			{#if appt.staff_name}<div><dt>With</dt><dd>{appt.staff_name}</dd></div>{/if}
			<div><dt>Takes</dt><dd>{duration(appt.duration_minutes)}</dd></div>
			{#if appt.price > 0}<div><dt>Price</dt><dd>{money(appt.price, currency)}, {exp.words.payAtVenue.toLowerCase()}</dd></div>{/if}
			{#if appt.notes}<div><dt>Notes</dt><dd class="bd-notes">{appt.notes}</dd></div>{/if}
		</dl>

		{#if error}<p class="bd-error" role="alert">{error}</p>{/if}

		{#if moving}
			<section class="bd-move" aria-labelledby="bd-move">
				<h2 id="bd-move">Pick a new time</h2>
				<SlotPicker
					serviceId={appt.service_id}
					staffId={appt.staff_id}
					timezone={tz}
					days={config.booking?.horizon_days ?? 14}
					bind:date={moveDate}
					selected={moveTo?.start ?? ''}
					{reload}
					onpick={(s) => (moveTo = s)}
				/>
				<div class="bd-actions">
					<button class="bd-btn" type="button" disabled={!moveTo || busy} onclick={move}>
						{moveTo ? `Move to ${dayLabel(tz, moveTo.start)}, ${clockIn(tz, moveTo.start)}` : 'Choose a time'}
					</button>
					<button class="bd-quiet" type="button" onclick={() => ((moving = false), (moveTo = null))}>Keep the current time</button>
				</div>
			</section>
		{:else if confirmingCancel}
			<div class="bd-actions" role="group" aria-label="Cancel this booking">
				<p>Cancel this booking? The time goes back to other customers.</p>
				<button class="bd-danger" type="button" disabled={busy} onclick={cancel}>Yes, cancel it</button>
				<button class="bd-quiet" type="button" onclick={() => (confirmingCancel = false)}>Keep it</button>
			</div>
		{:else if appt.can_reschedule || appt.can_cancel}
			<div class="bd-actions">
				{#if appt.can_reschedule}<button class="bd-btn" type="button" onclick={() => (moving = true)}>Change time</button>{/if}
				{#if appt.can_cancel}<button class="bd-quiet" type="button" onclick={() => (confirmingCancel = true)}>Cancel booking</button>{/if}
			</div>
		{:else if appt.status === 'REQUESTED' || appt.status === 'CONFIRMED'}
			<p class="bd-note">It is too close to the time to change this online.{#if tel} Call <a href={tel}>{formatPhone(config.store.phone)}</a>.{/if}</p>
		{/if}
	{/if}
</div>

<style>
	.bd {
		width: 100%;
		max-width: 720px;
		margin: 0 auto;
		padding: 16px var(--sf-gutter, 16px) 48px;
		color: var(--sf-text);
	}
	.bd-back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--sf-text-2);
		font-size: 14.5px;
		font-weight: 500;
		text-decoration: none;
	}
	.bd-done {
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
	.bd-when {
		margin: 4px 0 0;
		font-size: 18px;
		font-weight: 600;
		color: var(--sf-text-2);
	}
	.bd-facts {
		margin: 20px 0 0;
	}
	.bd-facts > div {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		padding: 12px 0;
		border-bottom: 1px solid var(--sf-border);
		font-size: 15px;
	}
	.bd-facts dt {
		color: var(--sf-text-2);
	}
	.bd-facts dd {
		margin: 0;
		text-align: right;
		font-weight: 500;
	}
	dd[data-status='CONFIRMED'] {
		color: var(--sf-success);
	}
	.bd-notes {
		white-space: pre-line;
	}
	.bd-move {
		margin-top: 24px;
	}
	.bd-move h2 {
		margin: 0 0 12px;
		font-size: 17px;
	}
	.bd-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		margin-top: 24px;
	}
	.bd-actions p {
		flex-basis: 100%;
		margin: 0;
	}
	.bd-btn,
	.bd-danger,
	.bd-quiet {
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
	.bd-btn {
		border: 0;
		background: var(--sf-primary);
		color: var(--sf-primary-ink);
	}
	.bd-btn:disabled {
		opacity: 0.5;
	}
	.bd-danger {
		border: 0;
		background: var(--sf-danger);
		color: #fff;
	}
	.bd-quiet {
		border: 1px solid var(--sf-border-strong);
		background: var(--sf-surface);
		color: var(--sf-text);
	}
	.bd-btn:focus-visible,
	.bd-danger:focus-visible,
	.bd-quiet:focus-visible,
	.bd-back:focus-visible {
		outline: 2px solid var(--sf-primary);
		outline-offset: 2px;
	}
	.bd-error {
		margin: 16px 0;
		color: var(--sf-danger);
	}
	.bd-note {
		margin-top: 24px;
		color: var(--sf-text-2);
	}
	.bd-note a {
		color: var(--sf-primary);
		font-weight: 600;
	}
	.bd-skel {
		height: 220px;
		margin-top: 20px;
		border-radius: var(--sf-radius);
		background: var(--sf-surface-2);
	}
</style>
