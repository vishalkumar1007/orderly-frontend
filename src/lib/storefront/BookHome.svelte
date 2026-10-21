<script lang="ts">
	import Phone from '@tabler/icons-svelte/icons/phone';
	import MapPin from '@tabler/icons-svelte/icons/map-pin';
	import type { StoreConfig, StoreService, StoreStaff } from '$lib/storefront/api';
	import type { Experience } from '$lib/storefront/experience';
	import { hoursRows } from '$lib/storefront/hours';
	import { formatPhone, money } from '$lib/storefront/format';
	import { duration } from '$lib/storefront/booking';
	import StoreIntro from './StoreIntro.svelte';

	/**
	 * Home for a business that sells time: barbers, salons, garages. The
	 * service list is the page; each row says how long it takes and what it
	 * costs, and Book goes straight to choosing a time.
	 */
	let {
		config,
		exp,
		services,
		staff,
		error = ''
	}: {
		config: StoreConfig;
		exp: Experience;
		services: StoreService[];
		staff: StoreStaff[];
		error?: string;
	} = $props();

	const store = $derived(config.store);
	const currency = $derived(store.currency ?? 'INR');
	const hours = $derived(config.hours);
	const hourRows = $derived(hoursRows(hours));
	const paused = $derived(config.ordering?.store_status === 'AWAY' || config.ordering?.store_status === 'CLOSED');
	const hero = $derived(config.homepage?.sections?.find((s) => s.enabled && s.type === 'HERO'));

	const facts = $derived.by(() => {
		const when = hours?.always_open ? 'Open every day' : hours?.detail || 'See opening hours below';
		return paused ? `${when}.` : `${when}. Book online and ${exp.words.payAtVenue.toLowerCase()}.`;
	});
	const tone = $derived(
		config.ordering?.store_status === 'BUSY' ? 'busy' : hours?.is_open ? 'open' : 'closed'
	);
	const tel = $derived(store.phone ? 'tel:' + store.phone.replace(/[^\d+]/g, '') : '');
	const initials = (name: string) =>
		name
			.split(/\s+/)
			.map((p) => p.charAt(0))
			.join('')
			.slice(0, 2)
			.toUpperCase();
</script>

<div class="bh">
	<StoreIntro
		{config}
		title={hero?.content?.title?.trim() || store.name}
		subtitle={hero?.content?.subtitle?.trim() || store.tagline || store.description}
		{facts}
		{tone}
		notice={paused ? config.ordering.closed_reason || 'Online booking is paused for now.' : ''}
	/>

	<div class="bh-body">
		<section class="bh-services" aria-labelledby="bh-services-title">
			<h2 id="bh-services-title" class="bh-h2">{exp.words.catalog}</h2>
			{#if error}
				<p class="bh-empty">{error}</p>
			{:else if !services.length}
				<p class="bh-empty">
					Online booking opens soon.
					{#if tel}<a href={tel}>Call {formatPhone(store.phone)}</a> to book a time.{/if}
				</p>
			{:else}
				<ul class="bh-list">
					{#each services as s (s.id)}
						<li class="bh-row">
							<div class="bh-what">
								<h3 class="bh-name">{s.name}</h3>
								<p class="bh-meta">
									<span>{duration(s.duration_minutes)}</span>
									{#if s.price > 0}<span class="bh-price">{money(s.price, currency)}</span>{/if}
								</p>
							</div>
							{#if paused}
								<span class="bh-off">Paused</span>
							{:else}
								<a class="bh-book" href={'/book/' + s.id} aria-label="Book {s.name}">Book</a>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<aside class="bh-side">
			{#if staff.length > 1}
				<section>
					<h2 class="bh-h3">Our {exp.words.staff.toLowerCase()}</h2>
					<ul class="bh-staff">
						{#each staff as person (person.id)}
							<li><span class="bh-avatar" aria-hidden="true">{initials(person.name)}</span>{person.name}</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if !hours.always_open && hourRows.length}
				<section>
					<h2 class="bh-h3">Opening hours</h2>
					<dl class="bh-hours">
						{#each hourRows as row (row.key)}
							<div class:bh-today={row.isToday}>
								<dt>{row.label}</dt>
								<dd>{row.closed ? 'Closed' : row.ranges.join(', ')}</dd>
							</div>
						{/each}
					</dl>
				</section>
			{/if}

			{#if store.address || tel}
				<section>
					<h2 class="bh-h3">Find us</h2>
					{#if store.address}<p class="bh-contact"><MapPin size={17} stroke={1.6} aria-hidden="true" />{store.address}</p>{/if}
					{#if tel}<p class="bh-contact"><Phone size={17} stroke={1.6} aria-hidden="true" /><a href={tel}>{formatPhone(store.phone)}</a></p>{/if}
				</section>
			{/if}
		</aside>
	</div>
</div>

<style>
	.bh {
		--sh-gutter: var(--sf-gutter, 16px);
		--bh-tint: color-mix(in srgb, var(--sf-primary) 14%, var(--sf-surface));
		width: 100%;
		max-width: var(--sf-maxw);
		margin: 0 auto;
		padding: 0 var(--sh-gutter) 40px;
		color: var(--sf-text);
	}
	.bh-body {
		display: grid;
		gap: 36px;
		padding-top: 32px;
	}
	.bh-h2 {
		margin: 0;
		font-family: var(--sf-font-display, var(--sf-font));
		font-size: 22px;
		font-weight: 700;
		letter-spacing: -0.015em;
	}
	.bh-h3 {
		margin: 0 0 10px;
		font-size: 16px;
		font-weight: 650;
	}
	.bh-list {
		margin: 8px 0 0;
		padding: 0;
		list-style: none;
	}
	.bh-row {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 18px 0;
		border-bottom: 1px solid var(--sf-border);
	}
	.bh-what {
		flex: 1;
		min-width: 0;
	}
	.bh-name {
		margin: 0;
		font-size: 16.5px;
		font-weight: 600;
	}
	.bh-meta {
		display: flex;
		gap: 14px;
		margin: 4px 0 0;
		color: var(--sf-text-2);
		font-size: 14px;
		font-variant-numeric: tabular-nums;
	}
	.bh-price {
		color: var(--sf-text);
		font-weight: 600;
	}
	.bh-book {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 88px;
		height: 40px;
		padding: 0 18px;
		border-radius: var(--sf-btn-radius, 10px);
		background: var(--sf-primary);
		color: var(--sf-primary-ink);
		font-weight: 650;
		text-decoration: none;
	}
	.bh-book:hover {
		filter: brightness(1.06);
	}
	.bh-book:focus-visible,
	.bh-contact a:focus-visible,
	.bh-empty a:focus-visible {
		outline: 2px solid var(--sf-primary);
		outline-offset: 2px;
	}
	.bh-off {
		color: var(--sf-text-3);
		font-size: 14px;
	}
	.bh-empty {
		margin: 12px 0 0;
		color: var(--sf-text-2);
	}
	.bh-empty a,
	.bh-contact a {
		color: var(--sf-primary);
		font-weight: 600;
		text-decoration: none;
	}

	.bh-side {
		display: grid;
		gap: 28px;
		align-content: start;
	}
	.bh-staff {
		display: flex;
		flex-wrap: wrap;
		gap: 10px 18px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 15px;
	}
	.bh-staff li {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.bh-avatar {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: var(--bh-tint);
		color: var(--sf-primary);
		font-size: 13px;
		font-weight: 700;
	}
	.bh-hours {
		margin: 0;
	}
	.bh-hours > div {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		padding: 7px 0;
		font-size: 14.5px;
		color: var(--sf-text-2);
	}
	.bh-hours dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
	}
	.bh-today {
		color: var(--sf-text) !important;
		font-weight: 600;
	}
	.bh-contact {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		margin: 0 0 8px;
		font-size: 14.5px;
		color: var(--sf-text-2);
	}
	.bh-contact :global(svg) {
		flex: none;
		margin-top: 2px;
	}

	@media (min-width: 720px) {
		.bh {
			--sh-gutter: 32px;
		}
	}
	@media (min-width: 1024px) {
		.bh-body {
			grid-template-columns: minmax(0, 1fr) 300px;
			gap: 64px;
		}
		.bh-side {
			position: sticky;
			top: calc(var(--sf-header-h, 60px) + 24px);
			padding: 22px;
			border: 1px solid var(--sf-border);
			border-radius: var(--sf-radius);
		}
	}
</style>
