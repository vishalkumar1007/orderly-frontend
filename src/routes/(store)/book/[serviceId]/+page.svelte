<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import ArrowLeft from '@tabler/icons-svelte/icons/arrow-left';
	import { ApiClientError } from '$lib/api/client';
	import { friendlyError, storefrontApi, type StoreSlot } from '$lib/storefront/api';
	import { experienceFor } from '$lib/storefront/experience';
	import { clockIn, dayLabel, duration } from '$lib/storefront/booking';
	import { money } from '$lib/storefront/format';
	import { customerToken } from '$lib/storefront/session.svelte';
	import SlotPicker from '$lib/storefront/SlotPicker.svelte';

	/**
	 * Book one service: who (when there is a choice), when, then confirm.
	 * The choices live in the URL, so signing in part-way through brings the
	 * customer back to the same step with nothing lost.
	 */
	let { data } = $props();

	const config = $derived(data.config!);
	const exp = $derived(experienceFor(config));
	const service = $derived(data.service);
	const staff = $derived(data.staff);
	const tz = $derived(config.hours?.timezone || 'Asia/Kolkata');
	const currency = $derived(config.store.currency ?? 'INR');
	const days = $derived(config.booking?.horizon_days ?? 14);
	const query = $derived($page.url.searchParams);

	const staffChoice = $derived(query.get('staff') ?? '');
	const start = $derived(query.get('start') ?? '');
	const startStaff = $derived(query.get('with') ?? '');
	let date = $state('');
	$effect.pre(() => {
		if (!date) date = query.get('date') ?? '';
	});

	let notes = $state('');
	let vehicle = $state('');
	let signedIn = $state(false);
	let booking = $state(false);
	let error = $state('');
	let reload = $state(0);
	const clientToken = crypto.randomUUID();

	onMount(() => {
		signedIn = Boolean(customerToken(data.tenantSlug ?? ''));
	});

	const staffName = (id: string) => staff.find((s) => s.id === id)?.name ?? '';
	const who = $derived(staffName(startStaff || staffChoice));

	/** Write a choice into the URL without a new history entry or a jump. */
	function setQuery(changes: Record<string, string>) {
		const q = new URLSearchParams($page.url.searchParams);
		for (const [k, v] of Object.entries(changes)) {
			if (v) q.set(k, v);
			else q.delete(k);
		}
		void goto(`?${q}`, { replaceState: true, noScroll: true, keepFocus: true });
	}

	function pick(slot: StoreSlot) {
		error = '';
		setQuery({ date, start: slot.start, with: slot.staff_id });
	}

	function chooseStaff(id: string) {
		setQuery({ staff: id, start: '', with: '' });
	}

	const needsVehicle = $derived(exp.features.vehicle);
	// Signing in comes first: what is typed here would not survive the trip.
	const canConfirm = $derived(Boolean(start) && (!signedIn || !needsVehicle || vehicle.trim().length >= 3));

	async function confirm() {
		const token = customerToken(data.tenantSlug ?? '');
		if (!token) {
			const next = `${$page.url.pathname}${$page.url.search}`;
			void goto(`/login?next=${encodeURIComponent(next)}`);
			return;
		}
		booking = true;
		error = '';
		const note = [needsVehicle && vehicle.trim() ? `Vehicle: ${vehicle.trim()}` : '', notes.trim()]
			.filter(Boolean)
			.join('\n');
		try {
			const appt = await storefrontApi.book(
				{ service_id: service.id, staff_id: startStaff || staffChoice, start, notes: note, client_token: clientToken },
				token
			);
			void goto(`/bookings/${appt.id}?new=1`);
		} catch (err) {
			if (err instanceof ApiClientError && err.code === 'slot_taken') {
				error = 'That time was just taken. Pick another.';
				setQuery({ start: '', with: '' });
				reload++;
			} else if (err instanceof ApiClientError && (err.status === 401 || err.code === 'sign_in_required')) {
				void goto(`/login?next=${encodeURIComponent(`${$page.url.pathname}${$page.url.search}`)}`);
			} else {
				error = friendlyError(err, 'Could not book. Try again.');
			}
		} finally {
			booking = false;
		}
	}
</script>

<svelte:head>
	<title>Book {service.name} | {config.store.name}</title>
</svelte:head>

<div class="bk">
	<a class="bk-back" href="/"><ArrowLeft size={18} stroke={1.8} aria-hidden="true" />{exp.words.catalog}</a>

	<header class="bk-head">
		<h1>{service.name}</h1>
		<p>
			<span>{duration(service.duration_minutes)}</span>
			{#if service.price > 0}<span class="bk-price">{money(service.price, currency)}</span>{/if}
		</p>
	</header>

	{#if staff.length > 1}
		<section class="bk-step" aria-labelledby="bk-who">
			<h2 id="bk-who">Who would you like?</h2>
			<div class="bk-chips" role="radiogroup" aria-labelledby="bk-who">
				<button type="button" role="radio" aria-checked={!staffChoice} onclick={() => chooseStaff('')}>Anyone available</button>
				{#each staff as person (person.id)}
					<button type="button" role="radio" aria-checked={staffChoice === person.id} onclick={() => chooseStaff(person.id)}>
						{person.name}
					</button>
				{/each}
			</div>
		</section>
	{/if}

	<section class="bk-step" aria-labelledby="bk-when">
		<h2 id="bk-when">When?</h2>
		<SlotPicker
			serviceId={service.id}
			staffId={staffChoice}
			timezone={tz}
			{days}
			bind:date
			selected={start}
			{reload}
			onpick={pick}
		/>
	</section>

	{#if error}<p class="bk-error" role="alert">{error}</p>{/if}

	{#if start}
		<section class="bk-step bk-confirm" aria-labelledby="bk-confirm">
			<h2 id="bk-confirm">Confirm your booking</h2>
			<p class="bk-summary">
				{service.name}{who ? ` with ${who}` : ''}, {dayLabel(tz, start)} at {clockIn(tz, start)}.
				{#if service.price > 0}{money(service.price, currency)},{/if}
				{exp.words.payAtVenue.toLowerCase()}.
			</p>

			{#if signedIn && needsVehicle}
				<label class="bk-field">
					<span>Your vehicle</span>
					<input type="text" bind:value={vehicle} maxlength="120" placeholder="Make, model and number plate" autocomplete="off" required />
				</label>
			{/if}
			{#if signedIn}
				<label class="bk-field">
					<span>Anything we should know? <em>Optional</em></span>
					<textarea bind:value={notes} maxlength="300" rows="2"></textarea>
				</label>
			{/if}

			<button class="bk-go" type="button" disabled={!canConfirm || booking} onclick={confirm}>
				{booking ? 'Booking…' : signedIn ? 'Confirm booking' : 'Sign in to book'}
			</button>
			{#if !signedIn}
				<p class="bk-hint">We text you a code to sign in, then bring you straight back here.</p>
			{/if}
		</section>
	{/if}
</div>

<style>
	.bk {
		--sh-gutter: var(--sf-gutter, 16px);
		width: 100%;
		max-width: 720px;
		margin: 0 auto;
		padding: 16px var(--sh-gutter) 48px;
		color: var(--sf-text);
	}
	.bk-back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--sf-text-2);
		font-size: 14.5px;
		font-weight: 500;
		text-decoration: none;
	}
	.bk-head h1 {
		margin: 16px 0 0;
		font-family: var(--sf-font-display, var(--sf-font));
		font-size: clamp(26px, 6vw, 36px);
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}
	.bk-head p {
		display: flex;
		gap: 14px;
		margin: 6px 0 0;
		color: var(--sf-text-2);
		font-size: 15px;
	}
	.bk-price {
		color: var(--sf-text);
		font-weight: 600;
	}
	.bk-step {
		margin-top: 28px;
	}
	.bk-step h2 {
		margin: 0 0 12px;
		font-size: 17px;
		font-weight: 650;
	}
	.bk-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.bk-chips button {
		height: 40px;
		padding: 0 16px;
		border: 1px solid var(--sf-border-strong);
		border-radius: 999px;
		background: var(--sf-surface);
		color: var(--sf-text);
		font: inherit;
		font-size: 14.5px;
		font-weight: 500;
		cursor: pointer;
	}
	.bk-chips button[aria-checked='true'] {
		border-color: var(--sf-primary);
		background: color-mix(in srgb, var(--sf-primary) 14%, var(--sf-surface));
		font-weight: 600;
	}
	.bk-confirm {
		padding: 20px;
		border: 1px solid var(--sf-border);
		border-radius: var(--sf-radius);
		background: var(--sf-surface);
		box-shadow: var(--sf-shadow-sm);
	}
	.bk-summary {
		margin: 0 0 16px;
		font-size: 15.5px;
		line-height: 1.5;
	}
	.bk-field {
		display: grid;
		gap: 6px;
		margin-bottom: 14px;
		font-size: 14px;
		font-weight: 600;
	}
	.bk-field em {
		font-style: normal;
		font-weight: 400;
		color: var(--sf-text-3);
	}
	.bk-field input,
	.bk-field textarea {
		padding: 10px 12px;
		border: 1px solid var(--sf-border-strong);
		border-radius: var(--sf-radius-sm);
		background: var(--sf-surface);
		color: var(--sf-text);
		font: inherit;
		font-size: 15px;
		font-weight: 400;
		resize: vertical;
	}
	.bk-go {
		width: 100%;
		height: 48px;
		border: 0;
		border-radius: var(--sf-btn-radius, 10px);
		background: var(--sf-primary);
		color: var(--sf-primary-ink);
		font: inherit;
		font-size: 16px;
		font-weight: 650;
		cursor: pointer;
	}
	.bk-go:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.bk-chips button:focus-visible,
	.bk-go:focus-visible,
	.bk-back:focus-visible,
	.bk-field input:focus-visible,
	.bk-field textarea:focus-visible {
		outline: 2px solid var(--sf-primary);
		outline-offset: 2px;
	}
	.bk-hint {
		margin: 10px 0 0;
		color: var(--sf-text-3);
		font-size: 13.5px;
		text-align: center;
	}
	.bk-error {
		margin: 16px 0 0;
		padding: 12px 14px;
		border-radius: var(--sf-radius-sm);
		background: var(--sf-danger-soft);
		color: var(--sf-danger);
		font-size: 14.5px;
	}
	@media (min-width: 720px) {
		.bk {
			--sh-gutter: 32px;
			padding-top: 24px;
		}
	}
</style>
