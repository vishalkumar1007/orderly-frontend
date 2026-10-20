<script lang="ts">
	import { onMount } from 'svelte';
	import Bed from '@tabler/icons-svelte/icons/bed';
	import { friendlyError, storefrontApi, type CustomerReservation } from '$lib/storefront/api';
	import { bookingStatus, dayLabel, nights } from '$lib/storefront/booking';
	import { customerToken } from '$lib/storefront/session.svelte';

	/** The signed-in guest's stays: what is coming up, then what is done. */
	let { data } = $props();

	const config = $derived(data.config!);
	const tz = $derived(config.hours?.timezone || 'Asia/Kolkata');

	let items = $state<CustomerReservation[]>([]);
	let loading = $state(true);
	let signedIn = $state(true);
	let error = $state('');

	onMount(async () => {
		const token = customerToken(data.tenantSlug ?? '');
		signedIn = Boolean(token);
		if (!token) {
			loading = false;
			return;
		}
		try {
			items = (await storefrontApi.reservations(token)).reservations;
		} catch (err) {
			error = friendlyError(err, 'Could not load your reservations.');
		} finally {
			loading = false;
		}
	});

	const done = new Set(['CHECKED_OUT', 'CANCELLED', 'NO_SHOW']);
	const upcoming = $derived(
		items.filter((r) => !done.has(r.status)).sort((a, b) => a.check_in.localeCompare(b.check_in))
	);
	const past = $derived(items.filter((a) => !upcoming.includes(a)));
</script>

<svelte:head><title>Your reservations | {config.store.name}</title></svelte:head>

<div class="hl">
	<h1>Your reservations</h1>

	{#if loading}
		<div class="hl-skel" aria-hidden="true"><span></span><span></span></div>
	{:else if !signedIn}
		<div class="hl-empty">
			<p>Sign in with your phone number to see your reservations.</p>
			<a class="hl-btn" href="/login?next=%2Freservations">Sign in</a>
		</div>
	{:else if error}
		<p class="hl-error" role="alert">{error}</p>
	{:else if !items.length}
		<div class="hl-empty">
			<Bed size={28} stroke={1.5} aria-hidden="true" />
			<p>No reservations yet. Choose your dates to see what is free.</p>
			<a class="hl-btn" href="/">See rooms</a>
		</div>
	{:else}
		{#each [{ title: 'Coming up', list: upcoming }, { title: 'Earlier', list: past }] as group (group.title)}
			{#if group.list.length}
				<h2>{group.title}</h2>
				<ul>
					{#each group.list as a (a.id)}
						{@const n = nights(a.check_in, a.check_out)}
						<li>
							<a href={'/reservations/' + a.id}>
								<span class="hl-when">
									<strong>{dayLabel(tz, a.check_in)}</strong>
									{n} {n === 1 ? 'night' : 'nights'}
								</span>
								<span class="hl-what">
									{a.room_type_name}
									<em>{a.guests} {a.guests === 1 ? 'guest' : 'guests'}</em>
								</span>
								<span class="hl-status" data-status={a.status}>{bookingStatus(a.status)}</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		{/each}
	{/if}
</div>

<style>
	.hl {
		width: 100%;
		max-width: 720px;
		margin: 0 auto;
		padding: 20px var(--sf-gutter, 16px) 48px;
		color: var(--sf-text);
	}
	h1 {
		margin: 0;
		font-family: var(--sf-font-display, var(--sf-font));
		font-size: 28px;
		font-weight: 800;
		letter-spacing: -0.02em;
	}
	h2 {
		margin: 28px 0 4px;
		font-size: 15px;
		font-weight: 600;
		color: var(--sf-text-2);
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li a {
		display: grid;
		grid-template-columns: 112px minmax(0, 1fr) auto;
		align-items: center;
		gap: 12px;
		padding: 16px 0;
		border-bottom: 1px solid var(--sf-border);
		color: inherit;
		text-decoration: none;
	}
	li a:focus-visible,
	.hl-btn:focus-visible {
		outline: 2px solid var(--sf-primary);
		outline-offset: 2px;
	}
	.hl-when {
		display: grid;
		font-size: 14px;
		color: var(--sf-text-2);
		font-variant-numeric: tabular-nums;
	}
	.hl-when strong {
		color: var(--sf-text);
		font-size: 15px;
	}
	.hl-what {
		display: grid;
		font-size: 15.5px;
		font-weight: 600;
	}
	.hl-what em {
		font-style: normal;
		font-weight: 400;
		font-size: 14px;
		color: var(--sf-text-2);
	}
	.hl-status {
		font-size: 13px;
		font-weight: 600;
		color: var(--sf-text-2);
	}
	.hl-status[data-status='CONFIRMED'] {
		color: var(--sf-success);
	}
	.hl-status[data-status='CANCELLED'],
	.hl-status[data-status='NO_SHOW'] {
		color: var(--sf-text-3);
	}
	.hl-empty {
		display: grid;
		justify-items: start;
		gap: 12px;
		margin-top: 24px;
		color: var(--sf-text-2);
	}
	.hl-empty p {
		margin: 0;
	}
	.hl-btn {
		display: inline-flex;
		align-items: center;
		height: 42px;
		padding: 0 18px;
		border-radius: var(--sf-btn-radius, 10px);
		background: var(--sf-primary);
		color: var(--sf-primary-ink);
		font-weight: 650;
		text-decoration: none;
	}
	.hl-error {
		margin-top: 20px;
		color: var(--sf-danger);
	}
	.hl-skel {
		display: grid;
		gap: 10px;
		margin-top: 24px;
	}
	.hl-skel span {
		height: 64px;
		border-radius: var(--sf-radius-sm);
		background: var(--sf-surface-2);
	}
</style>
