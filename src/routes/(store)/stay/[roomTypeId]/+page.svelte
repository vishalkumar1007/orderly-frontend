<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import ArrowLeft from '@tabler/icons-svelte/icons/arrow-left';
	import Users from '@tabler/icons-svelte/icons/users';
	import Bed from '@tabler/icons-svelte/icons/bed';
	import { ApiClientError } from '$lib/api/client';
	import { friendlyError, storefrontApi } from '$lib/storefront/api';
	import { experienceFor } from '$lib/storefront/experience';
	import { addDays, dateIn, dayLabel, stayRangeError } from '$lib/storefront/booking';
	import { money } from '$lib/storefront/format';
	import { customerToken } from '$lib/storefront/session.svelte';

	/**
	 * One room type. With dates the guest sees the whole stay's price and can
	 * reserve; without, they pick dates here. Reserving needs sign-in, and
	 * the dates ride along in the URL so the sign-in round trip keeps them.
	 */
	let { data } = $props();

	const config = $derived(data.config!);
	const exp = $derived(experienceFor(config));
	const room = $derived(data.room);
	const stay = $derived(data.stay);
	const tz = $derived(config.hours?.timezone || 'Asia/Kolkata');
	const currency = $derived(config.store.currency ?? 'INR');
	const today = $derived(dateIn(tz));
	const maxNights = $derived(config.booking?.max_nights ?? 30);

	let checkIn = $state('');
	let checkOut = $state('');
	let guests = $state(2);
	let notes = $state('');
	let formError = $state('');
	let error = $state('');
	let reserving = $state(false);
	let signedIn = $state(false);
	const clientToken = crypto.randomUUID();

	$effect.pre(() => {
		checkIn = stay?.check_in ?? today;
		checkOut = stay?.check_out ?? addDays(today, 1);
		guests = Math.min(stay?.guests ?? 2, room.max_guests);
	});

	onMount(() => {
		signedIn = Boolean(customerToken(data.tenantSlug ?? ''));
	});

	const soldOut = $derived(Boolean(stay) && (room.available ?? 0) < 1);
	const tooMany = $derived(Boolean(stay) && (stay?.guests ?? 0) > room.max_guests);

	function search(event: SubmitEvent) {
		event.preventDefault();
		formError = stayRangeError(checkIn, checkOut, today, maxNights);
		if (formError) return;
		const q = new URLSearchParams({ check_in: checkIn, check_out: checkOut, guests: String(guests) });
		void goto(`?${q}`, { replaceState: true, noScroll: true, keepFocus: true });
	}

	async function reserve() {
		if (!stay) return;
		const token = customerToken(data.tenantSlug ?? '');
		if (!token) {
			void goto(`/login?next=${encodeURIComponent($page.url.pathname + $page.url.search)}`);
			return;
		}
		reserving = true;
		error = '';
		try {
			const res = await storefrontApi.reserve(
				{ ...stay, room_type_id: room.id, notes: notes.trim(), client_token: clientToken },
				token
			);
			void goto(`/reservations/${res.id}?new=1`);
		} catch (err) {
			if (err instanceof ApiClientError && err.code === 'sold_out') {
				error = 'That room was just taken for these dates. Try other dates or another room.';
			} else if (err instanceof ApiClientError && err.status === 401) {
				void goto(`/login?next=${encodeURIComponent($page.url.pathname + $page.url.search)}`);
			} else {
				error = friendlyError(err, 'Could not reserve. Try again.');
			}
		} finally {
			reserving = false;
		}
	}
</script>

<svelte:head><title>{room.name} | {config.store.name}</title></svelte:head>

<div class="rd">
	<a class="rd-back" href={stay ? `/?${new URLSearchParams({ check_in: stay.check_in, check_out: stay.check_out, guests: String(stay.guests) })}` : '/'}>
		<ArrowLeft size={18} stroke={1.8} aria-hidden="true" />All {exp.words.catalog.toLowerCase()}
	</a>

	<div class="rd-grid">
		<div class="rd-photo">
			{#if room.image_url}<img src={room.image_url} alt="" />{:else}<Bed size={48} stroke={1.3} />{/if}
		</div>

		<div class="rd-main">
			<h1>{room.name}</h1>
			<p class="rd-cap"><Users size={17} stroke={1.6} aria-hidden="true" />Up to {room.max_guests} {room.max_guests === 1 ? 'guest' : 'guests'}</p>
			{#if room.description}<p class="rd-desc">{room.description}</p>{/if}
			<p class="rd-rate"><strong>{money(room.base_price, currency)}</strong> a night</p>

			<form class="rd-dates" onsubmit={search} novalidate>
				<label><span>Check-in</span><input type="date" min={today} bind:value={checkIn} onchange={() => checkOut <= checkIn && (checkOut = addDays(checkIn, 1))} /></label>
				<label><span>Check-out</span><input type="date" min={addDays(checkIn || today, 1)} bind:value={checkOut} /></label>
				<label><span>Guests</span>
					<select bind:value={guests}>
						{#each Array.from({ length: room.max_guests }, (_, i) => i + 1) as n (n)}<option value={n}>{n}</option>{/each}
					</select>
				</label>
				<button type="submit">{stay ? 'Update' : 'Check availability'}</button>
				{#if formError || data.searchError}<p class="rd-error" role="alert">{formError || data.searchError}</p>{/if}
			</form>

			{#if stay}
				<section class="rd-summary" aria-live="polite">
					{#if tooMany}
						<p>This room fits up to {room.max_guests} guests. Choose fewer guests or another room.</p>
					{:else if soldOut}
						<p>Sold out for {dayLabel(tz, stay.check_in)} to {dayLabel(tz, stay.check_out)}. Try other dates.</p>
					{:else}
						<p class="rd-total">
							{money(room.total ?? 0, currency)}
							<span>for {room.nights} {room.nights === 1 ? 'night' : 'nights'}, {dayLabel(tz, stay.check_in)} to {dayLabel(tz, stay.check_out)}</span>
						</p>
						<p class="rd-pay">{exp.words.payAtVenue}.{#if (room.available ?? 0) <= 2} Only {room.available} left.{/if}</p>
						<label class="rd-notes">
							<span>Arrival time or requests <em>Optional</em></span>
							<textarea bind:value={notes} maxlength="300" rows="2"></textarea>
						</label>
						{#if error}<p class="rd-error" role="alert">{error}</p>{/if}
						<button class="rd-go" type="button" disabled={reserving} onclick={reserve}>
							{reserving ? 'Reserving…' : signedIn ? 'Reserve' : 'Sign in to reserve'}
						</button>
					{/if}
				</section>
			{/if}
		</div>
	</div>
</div>

<style>
	.rd {
		width: 100%;
		max-width: var(--sf-maxw);
		margin: 0 auto;
		padding: 16px var(--sf-gutter, 16px) 48px;
		color: var(--sf-text);
	}
	.rd-back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--sf-text-2);
		font-size: 14.5px;
		font-weight: 500;
		text-decoration: none;
	}
	.rd-grid {
		display: grid;
		gap: 20px;
		margin-top: 16px;
	}
	.rd-photo {
		display: grid;
		place-items: center;
		aspect-ratio: 4 / 3;
		overflow: hidden;
		border-radius: var(--sf-radius);
		background: color-mix(in srgb, var(--sf-primary) 12%, var(--sf-surface));
		color: var(--sf-primary);
	}
	.rd-photo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	h1 {
		margin: 0;
		font-family: var(--sf-font-display, var(--sf-font));
		font-size: clamp(26px, 6vw, 36px);
		font-weight: 800;
		letter-spacing: -0.02em;
	}
	.rd-cap {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin: 8px 0 0;
		color: var(--sf-text-2);
	}
	.rd-desc {
		margin: 12px 0 0;
		line-height: 1.55;
		color: var(--sf-text-2);
		max-width: 60ch;
	}
	.rd-rate {
		margin: 12px 0 0;
		color: var(--sf-text-2);
	}
	.rd-rate strong {
		color: var(--sf-text);
		font-size: 20px;
	}
	.rd-dates {
		display: grid;
		grid-template-columns: 1fr 1fr 90px;
		gap: 10px;
		margin-top: 20px;
	}
	.rd-dates label,
	.rd-notes {
		display: grid;
		gap: 4px;
		font-size: 13px;
		font-weight: 600;
		color: var(--sf-text-2);
	}
	.rd-dates input,
	.rd-dates select,
	.rd-notes textarea {
		height: 44px;
		padding: 0 10px;
		border: 1px solid var(--sf-border-strong);
		border-radius: var(--sf-radius-sm);
		background: var(--sf-surface);
		color: var(--sf-text);
		font: inherit;
		font-size: 15px;
		color-scheme: light dark;
	}
	.rd-notes textarea {
		height: auto;
		padding: 10px;
		resize: vertical;
	}
	.rd-notes em {
		font-style: normal;
		font-weight: 400;
		color: var(--sf-text-3);
	}
	.rd-dates button {
		grid-column: 1 / -1;
		height: 44px;
		border: 1px solid var(--sf-border-strong);
		border-radius: var(--sf-btn-radius, 10px);
		background: var(--sf-surface);
		color: var(--sf-text);
		font: inherit;
		font-weight: 650;
		cursor: pointer;
	}
	.rd-summary {
		display: grid;
		gap: 12px;
		margin-top: 20px;
		padding: 20px;
		border: 1px solid var(--sf-border);
		border-radius: var(--sf-radius);
		background: var(--sf-surface);
		box-shadow: var(--sf-shadow-sm);
	}
	.rd-summary p {
		margin: 0;
	}
	.rd-total {
		display: grid;
		font-size: 26px;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}
	.rd-total span {
		font-size: 14.5px;
		font-weight: 500;
		color: var(--sf-text-2);
	}
	.rd-pay {
		color: var(--sf-text-2);
	}
	.rd-go {
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
	.rd-go:disabled {
		opacity: 0.6;
	}
	.rd-error {
		grid-column: 1 / -1;
		margin: 0;
		color: var(--sf-danger);
		font-size: 14px;
	}
	.rd-back:focus-visible,
	.rd-dates input:focus-visible,
	.rd-dates select:focus-visible,
	.rd-dates button:focus-visible,
	.rd-go:focus-visible,
	.rd-notes textarea:focus-visible {
		outline: 2px solid var(--sf-primary);
		outline-offset: 2px;
	}
	@media (min-width: 900px) {
		.rd {
			padding-inline: 32px;
		}
		.rd-grid {
			grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
			gap: 40px;
			align-items: start;
		}
	}
</style>
