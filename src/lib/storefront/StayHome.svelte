<script lang="ts">
	import { goto } from '$app/navigation';
	import Users from '@tabler/icons-svelte/icons/users';
	import Bed from '@tabler/icons-svelte/icons/bed';
	import type { StaySearch, StoreConfig, StoreRoomType } from '$lib/storefront/api';
	import type { Experience } from '$lib/storefront/experience';
	import { money } from '$lib/storefront/format';
	import { addDays, dateIn, nights, stayRangeError } from '$lib/storefront/booking';
	import StoreIntro from './StoreIntro.svelte';

	/**
	 * Home for a hotel or guest house. A guest's first question is "do you
	 * have a room for my dates?", so the date search sits right under the
	 * intro, and every room type answers it with a price for the whole stay.
	 */
	let {
		config,
		exp,
		roomTypes,
		search = null,
		error = ''
	}: {
		config: StoreConfig;
		exp: Experience;
		roomTypes: StoreRoomType[];
		search?: StaySearch | null;
		error?: string;
	} = $props();

	const store = $derived(config.store);
	const currency = $derived(store.currency ?? 'INR');
	const tz = $derived(config.hours?.timezone || 'Asia/Kolkata');
	const maxNights = $derived(config.booking?.max_nights ?? 30);
	const today = $derived(dateIn(tz));
	const hero = $derived(config.homepage?.sections?.find((s) => s.enabled && s.type === 'HERO'));
	const paused = $derived(config.ordering?.store_status === 'AWAY' || config.ordering?.store_status === 'CLOSED');
	const maxGuests = $derived(Math.max(2, ...roomTypes.map((r) => r.max_guests)));

	// The form starts from the last search, or tonight for one night.
	let checkIn = $state('');
	let checkOut = $state('');
	let guests = $state(2);
	let formError = $state('');
	$effect.pre(() => {
		checkIn = search?.check_in ?? today;
		checkOut = search?.check_out ?? addDays(today, 1);
		guests = search?.guests ?? 2;
	});

	const stayNights = $derived(search ? nights(search.check_in, search.check_out) : 0);

	function submit(event: SubmitEvent) {
		event.preventDefault();
		formError = stayRangeError(checkIn, checkOut, today, maxNights);
		if (formError) return;
		const q = new URLSearchParams({ check_in: checkIn, check_out: checkOut, guests: String(guests) });
		void goto(`/?${q}`, { keepFocus: true, noScroll: true });
	}

	/** Keep check-out after check-in when the guest moves check-in forward. */
	function onCheckIn() {
		if (checkOut <= checkIn) checkOut = addDays(checkIn, 1);
	}

	const roomHref = (id: string) =>
		'/stay/' + id + (search ? `?${new URLSearchParams({ check_in: search.check_in, check_out: search.check_out, guests: String(search.guests) })}` : '');
</script>

<div class="st">
	<StoreIntro
		{config}
		title={hero?.content?.title?.trim() || store.name}
		subtitle={hero?.content?.subtitle?.trim() || store.tagline || store.description}
		facts={paused ? 'Online booking is paused for now.' : `Book online and ${exp.words.payAtVenue.toLowerCase()}.`}
		tone={paused ? 'closed' : 'open'}
		notice={paused ? config.ordering.closed_reason : ''}
	/>

	<form class="st-search" onsubmit={submit} novalidate>
		<label>
			<span>Check-in</span>
			<input type="date" name="check_in" min={today} bind:value={checkIn} onchange={onCheckIn} required />
		</label>
		<label>
			<span>Check-out</span>
			<input type="date" name="check_out" min={addDays(checkIn || today, 1)} bind:value={checkOut} required />
		</label>
		<label>
			<span>Guests</span>
			<select name="guests" bind:value={guests}>
				{#each Array.from({ length: maxGuests }, (_, i) => i + 1) as n (n)}
					<option value={n}>{n} {n === 1 ? 'guest' : 'guests'}</option>
				{/each}
			</select>
		</label>
		<button type="submit">Check availability</button>
		{#if formError}<p class="st-error" role="alert">{formError}</p>{/if}
	</form>

	<section class="st-rooms" aria-labelledby="st-rooms-title">
		<h2 id="st-rooms-title" class="st-h2">
			{#if search && stayNights}
				Rooms for {stayNights} {stayNights === 1 ? 'night' : 'nights'}, {search.guests} {search.guests === 1 ? 'guest' : 'guests'}
			{:else}
				{exp.words.catalog}
			{/if}
		</h2>

		{#if error}
			<p class="st-empty">{error}</p>
		{:else if !roomTypes.length}
			<p class="st-empty">Rooms will be listed here soon.</p>
		{:else}
			<ul class="st-list">
				{#each roomTypes as room (room.id)}
					{@const fits = !search || search.guests <= room.max_guests}
					{@const open = !search || ((room.available ?? 0) > 0 && fits)}
					<li class="st-room" data-off={!open}>
						<a class="st-photo" href={roomHref(room.id)} tabindex="-1" aria-hidden="true">
							{#if room.image_url}
								<img src={room.image_url} alt="" loading="lazy" />
							{:else}
								<Bed size={34} stroke={1.4} />
							{/if}
						</a>
						<div class="st-info">
							<h3 class="st-name"><a href={roomHref(room.id)}>{room.name}</a></h3>
							{#if room.description}<p class="st-desc">{room.description}</p>{/if}
							<p class="st-cap"><Users size={16} stroke={1.6} aria-hidden="true" />Up to {room.max_guests} {room.max_guests === 1 ? 'guest' : 'guests'}</p>
						</div>
						<div class="st-price">
							{#if search && !fits}
								<p class="st-note">Fits up to {room.max_guests} guests</p>
							{:else if search && !open}
								<p class="st-note">Sold out for these dates</p>
							{:else if search && room.total !== undefined}
								<p class="st-total">{money(room.total, currency)}</p>
								<p class="st-per">for {room.nights} {room.nights === 1 ? 'night' : 'nights'}</p>
								{#if (room.available ?? 0) <= 2}<p class="st-left">{room.available} left</p>{/if}
								{#if !paused}<a class="st-reserve" href={roomHref(room.id)}>Reserve</a>{/if}
							{:else}
								<p class="st-total">{money(room.base_price, currency)}</p>
								<p class="st-per">a night</p>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<style>
	.st {
		--sh-gutter: var(--sf-gutter, 16px);
		width: 100%;
		max-width: 1088px;
		margin: 0 auto;
		padding: 0 var(--sh-gutter) 40px;
		color: var(--sf-text);
	}

	.st-search {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-top: 24px;
		padding: 16px;
		border: 1px solid var(--sf-border);
		border-radius: var(--sf-radius);
		background: var(--sf-surface);
		box-shadow: var(--sf-shadow-sm);
	}
	.st-search label {
		display: grid;
		gap: 4px;
		font-size: 13px;
		font-weight: 600;
		color: var(--sf-text-2);
	}
	.st-search label:nth-of-type(3) {
		grid-column: 1 / -1;
	}
	.st-search input,
	.st-search select {
		height: 44px;
		padding: 0 12px;
		border: 1px solid var(--sf-border-strong);
		border-radius: var(--sf-radius-sm);
		background: var(--sf-surface);
		color: var(--sf-text);
		font: inherit;
		font-size: 15px;
		font-weight: 500;
		color-scheme: light dark;
	}
	.st-search input:focus-visible,
	.st-search select:focus-visible,
	.st-search button:focus-visible,
	.st-reserve:focus-visible,
	.st-name a:focus-visible {
		outline: 2px solid var(--sf-primary);
		outline-offset: 2px;
	}
	.st-search button {
		grid-column: 1 / -1;
		height: 46px;
		border: 0;
		border-radius: var(--sf-btn-radius, 10px);
		background: var(--sf-primary);
		color: var(--sf-primary-ink);
		font: inherit;
		font-size: 15.5px;
		font-weight: 650;
		cursor: pointer;
	}
	.st-error {
		grid-column: 1 / -1;
		margin: 0;
		color: var(--sf-danger);
		font-size: 14px;
	}

	.st-rooms {
		padding-top: 32px;
	}
	.st-h2 {
		margin: 0;
		font-family: var(--sf-font-display, var(--sf-font));
		font-size: 22px;
		font-weight: 700;
		letter-spacing: -0.015em;
	}
	.st-empty {
		margin: 12px 0 0;
		color: var(--sf-text-2);
	}
	.st-list {
		margin: 8px 0 0;
		padding: 0;
		list-style: none;
	}
	.st-room {
		display: grid;
		grid-template-columns: 96px minmax(0, 1fr);
		gap: 6px 16px;
		padding: 20px 0;
		border-bottom: 1px solid var(--sf-border);
	}
	.st-room[data-off='true'] .st-photo {
		opacity: 0.55;
	}
	.st-photo {
		grid-row: span 2;
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		overflow: hidden;
		border-radius: var(--sf-radius-sm);
		background: color-mix(in srgb, var(--sf-primary) 12%, var(--sf-surface));
		color: var(--sf-primary);
	}
	.st-photo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.st-name {
		margin: 0;
		font-size: 17px;
		font-weight: 650;
	}
	.st-name a {
		color: inherit;
		text-decoration: none;
	}
	.st-desc {
		margin: 4px 0 0;
		color: var(--sf-text-2);
		font-size: 14px;
		line-height: 1.45;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.st-cap {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin: 8px 0 0;
		color: var(--sf-text-2);
		font-size: 13.5px;
	}
	.st-price {
		grid-column: 2;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 8px;
	}
	.st-price p {
		margin: 0;
	}
	.st-total {
		font-size: 18px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.st-per {
		color: var(--sf-text-2);
		font-size: 14px;
	}
	.st-left {
		color: var(--sf-warn);
		font-size: 13.5px;
		font-weight: 600;
	}
	.st-note {
		color: var(--sf-text-2);
		font-size: 14px;
	}
	.st-reserve {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-left: auto;
		height: 40px;
		padding: 0 20px;
		border-radius: var(--sf-btn-radius, 10px);
		background: var(--sf-primary);
		color: var(--sf-primary-ink);
		font-weight: 650;
		text-decoration: none;
	}

	@media (min-width: 720px) {
		.st {
			--sh-gutter: 32px;
		}
		.st-search {
			grid-template-columns: 1fr 1fr 160px auto;
			align-items: end;
		}
		.st-search label:nth-of-type(3) {
			grid-column: auto;
		}
		.st-search button {
			grid-column: auto;
			padding: 0 22px;
		}
		.st-room {
			grid-template-columns: 220px minmax(0, 1fr) 200px;
			gap: 20px;
			align-items: start;
		}
		.st-photo {
			grid-row: auto;
			aspect-ratio: 4 / 3;
		}
		.st-price {
			grid-column: auto;
			flex-direction: column;
			align-items: flex-end;
			text-align: right;
		}
		.st-reserve {
			margin: 8px 0 0;
		}
	}
</style>
