<script lang="ts">
	/**
	 * When each team member takes bookings. The storefront only offers times
	 * inside these hours, so a business with none set has nothing bookable;
	 * the empty state says exactly that.
	 */
	import { onMount } from 'svelte';
	import X from '@tabler/icons-svelte/icons/x';
	import ConfigCard from '$lib/components/config/ConfigCard.svelte';
	import { toast } from '$lib/components/admin/toast';
	import { addStaffHours, listStaffHours, removeStaffHours, type StaffHours } from '$lib/tenant/servicesApi';
	import { listShopUsers, type ShopUser } from '$lib/tenant/staffApi';
	import { formatClock } from '$lib/storefront/hours';

	// Monday first, as people read a week; stored as Go's 0 = Sunday.
	const DAYS = [
		{ n: 1, label: 'Mon' },
		{ n: 2, label: 'Tue' },
		{ n: 3, label: 'Wed' },
		{ n: 4, label: 'Thu' },
		{ n: 5, label: 'Fri' },
		{ n: 6, label: 'Sat' },
		{ n: 0, label: 'Sun' }
	];
	const dayLabel = (n: number) => DAYS.find((d) => d.n === n)?.label ?? '';
	const order = (n: number) => (n + 6) % 7;

	let staff = $state<ShopUser[]>([]);
	let hours = $state<StaffHours[]>([]);
	let loading = $state(true);
	let adding = $state<string | null>(null);
	let draft = $state({ days: [1, 2, 3, 4, 5] as number[], start: '09:00', end: '18:00' });
	let saving = $state(false);

	async function load() {
		try {
			const [users, rows] = await Promise.all([listShopUsers(), listStaffHours()]);
			staff = users.filter((u) => u.status === 'ACTIVE');
			hours = rows;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not load working hours');
		} finally {
			loading = false;
		}
	}
	onMount(load);

	const forStaff = (id: string) =>
		hours
			.filter((h) => h.staff_id === id)
			.sort((a, b) => order(a.weekday) - order(b.weekday) || a.start_time.localeCompare(b.start_time));

	function toggleDay(n: number) {
		draft.days = draft.days.includes(n) ? draft.days.filter((d) => d !== n) : [...draft.days, n];
	}

	async function save(staffId: string) {
		if (!draft.days.length) return toast.error('Pick at least one day');
		if (draft.end <= draft.start) return toast.error('The end time must be after the start time');
		saving = true;
		try {
			for (const weekday of draft.days) {
				await addStaffHours({ staff_id: staffId, weekday, start_time: draft.start, end_time: draft.end });
			}
			toast.success('Working hours added');
			adding = null;
			hours = await listStaffHours();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not add working hours');
		} finally {
			saving = false;
		}
	}

	async function remove(row: StaffHours) {
		try {
			await removeStaffHours(row.id);
			hours = hours.filter((h) => h.id !== row.id);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not remove those hours');
		}
	}
</script>

<ConfigCard
	id="wh"
	title="Working hours"
	description="Customers can book a team member only inside these hours. Times already booked are left out automatically."
	flush
>
	{#if loading}
		<p class="wh-note">Loading…</p>
	{:else if !staff.length}
		<p class="wh-note">Add your team under IAM first, then set when each person takes bookings.</p>
	{:else}
		{#each staff as person (person.id)}
			{@const rows = forStaff(person.id)}
			<div class="wh-row">
				<div class="wh-who">
					<strong>{person.name}</strong>
					{#if !rows.length}<span class="wh-none">Not bookable yet</span>{/if}
				</div>
				<ul class="wh-ranges">
					{#each rows as r (r.id)}
						<li>
							<span>{dayLabel(r.weekday)} {formatClock(r.start_time)} to {formatClock(r.end_time)}</span>
							<button type="button" aria-label="Remove {dayLabel(r.weekday)} {r.start_time} to {r.end_time}" onclick={() => remove(r)}>
								<X size={14} stroke={1.8} />
							</button>
						</li>
					{/each}
				</ul>
				{#if adding === person.id}
					<div class="wh-form">
						<div class="wh-days" role="group" aria-label="Days">
							{#each DAYS as d (d.n)}
								<button type="button" aria-pressed={draft.days.includes(d.n)} onclick={() => toggleDay(d.n)}>{d.label}</button>
							{/each}
						</div>
						<label>From <input type="time" bind:value={draft.start} /></label>
						<label>To <input type="time" bind:value={draft.end} /></label>
						<button type="button" class="btn btn-primary" disabled={saving} onclick={() => save(person.id)}>
							{saving ? 'Adding…' : 'Add hours'}
						</button>
						<button type="button" class="btn btn-ghost" onclick={() => (adding = null)}>Cancel</button>
					</div>
				{:else}
					<button type="button" class="btn btn-ghost wh-add" onclick={() => (adding = person.id)}>Add hours</button>
				{/if}
			</div>
		{/each}
	{/if}
</ConfigCard>

<style>
	.wh-note {
		margin: 0;
		padding: var(--sp-8) var(--sp-10);
		color: var(--text-3);
		font-size: var(--fs-tab);
	}
	.wh-row {
		display: grid;
		gap: var(--sp-4);
		padding: var(--sp-8) var(--sp-10);
		border-top: 1px solid var(--border-subtle);
	}
	.wh-row:first-child {
		border-top: 0;
	}
	.wh-who {
		display: flex;
		align-items: baseline;
		gap: var(--sp-6);
	}
	.wh-none {
		color: var(--warn);
		font-size: var(--fs-tab);
	}
	.wh-ranges {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-3);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.wh-ranges li {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		padding: 2px 4px 2px 10px;
		border: 1px solid var(--border-subtle);
		border-radius: 999px;
		background: var(--surface-2);
		font-size: var(--fs-tab);
	}
	.wh-ranges button {
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: var(--text-3);
		cursor: pointer;
	}
	.wh-ranges button:hover {
		background: var(--surface-3, var(--surface));
		color: var(--text);
	}
	.wh-add {
		justify-self: start;
	}
	.wh-form {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-6);
	}
	.wh-days {
		display: inline-flex;
		padding: 2px;
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.wh-days button {
		padding: var(--sp-3) var(--sp-5);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-3);
		font: inherit;
		font-size: var(--fs-tab);
		font-weight: 500;
		cursor: pointer;
	}
	.wh-days button[aria-pressed='true'] {
		background: var(--accent-soft);
		color: var(--text);
		font-weight: 600;
	}
	.wh-form label {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-3);
		color: var(--text-2);
		font-size: var(--fs-tab);
	}
	.wh-form input {
		height: 34px;
		padding: 0 var(--sp-4);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--text);
		font: inherit;
	}
</style>
