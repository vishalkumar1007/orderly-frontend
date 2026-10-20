<script lang="ts">
	import { onMount } from 'svelte';
	import Calendar from '@tabler/icons-svelte/icons/calendar';
	import { friendlyError, storefrontApi, type CustomerAppointment } from '$lib/storefront/api';
	import { bookingStatus, clockIn, dayLabel } from '$lib/storefront/booking';
	import { customerToken } from '$lib/storefront/session.svelte';

	/** The signed-in customer's bookings: what is coming up, then what is done. */
	let { data } = $props();

	const config = $derived(data.config!);
	const tz = $derived(config.hours?.timezone || 'Asia/Kolkata');

	let items = $state<CustomerAppointment[]>([]);
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
			items = (await storefrontApi.appointments(token)).appointments;
		} catch (err) {
			error = friendlyError(err, 'Could not load your bookings.');
		} finally {
			loading = false;
		}
	});

	const done = new Set(['COMPLETED', 'CANCELLED', 'NO_SHOW']);
	const upcoming = $derived(
		items
			.filter((a) => !done.has(a.status) && Date.parse(a.ends_at) > Date.now())
			.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
	);
	const past = $derived(items.filter((a) => !upcoming.includes(a)));
</script>

<svelte:head><title>Your bookings | {config.store.name}</title></svelte:head>

<div class="hl">
	<h1>Your bookings</h1>

	{#if loading}
		<div class="hl-skel" aria-hidden="true"><span></span><span></span></div>
	{:else if !signedIn}
		<div class="hl-empty">
			<p>Sign in with your phone number to see your bookings.</p>
			<a class="hl-btn" href="/login?next=%2Fbookings">Sign in</a>
		</div>
	{:else if error}
		<p class="hl-error" role="alert">{error}</p>
	{:else if !items.length}
		<div class="hl-empty">
			<Calendar size={28} stroke={1.5} aria-hidden="true" />
			<p>No bookings yet. Pick a service and a time that suits you.</p>
			<a class="hl-btn" href="/">See services</a>
		</div>
	{:else}
		{#each [{ title: 'Coming up', list: upcoming }, { title: 'Earlier', list: past }] as group (group.title)}
			{#if group.list.length}
				<h2>{group.title}</h2>
				<ul>
					{#each group.list as a (a.id)}
						<li>
							<a href={'/bookings/' + a.id}>
								<span class="hl-when">
									<strong>{dayLabel(tz, a.scheduled_at)}</strong>
									{clockIn(tz, a.scheduled_at)}
								</span>
								<span class="hl-what">
									{a.service_name}
									{#if a.staff_name}<em>with {a.staff_name}</em>{/if}
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
