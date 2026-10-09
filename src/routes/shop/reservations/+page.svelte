<script lang="ts">
	import { onMount } from 'svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import {
		addCharge,
		cancelReservation,
		checkInReservation,
		checkOutReservation,
		confirmReservation,
		createReservation,
		getFolio,
		listReservations,
		noShowReservation,
		type Charge,
		type Reservation
	} from '$lib/tenant/reservationsApi';
	import { listRoomTypes, listRooms, type Room, type RoomType } from '$lib/tenant/hotelApi';
	import DataTable from '$lib/components/admin/DataTable.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import Menu from '$lib/components/admin/Menu.svelte';
	import Modal from '$lib/components/admin/Modal.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import SlideOver from '$lib/components/admin/SlideOver.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';

	let reservations = $state<Reservation[]>([]);
	let roomTypes = $state<RoomType[]>([]);
	let rooms = $state<Room[]>([]);
	let loading = $state(true);

	let formOpen = $state(false);
	let form = $state({ room_type_id: '', check_in_date: '', check_out_date: '', guests: '1' });
	let errors = $state<Record<string, string>>({});
	let saving = $state(false);

	let checkInOpen = $state(false);
	let checkInTarget = $state<Reservation | null>(null);
	let checkInRoomId = $state('');
	let checkInSaving = $state(false);

	let folioOpen = $state(false);
	let folioReservation = $state<Reservation | null>(null);
	let folioCharges = $state<Charge[]>([]);
	let folioTotal = $state(0);
	let folioLoading = $state(false);
	let chargeForm = $state({ description: '', amount: '0' });

	const typeName = (id: string) => roomTypes.find((t) => t.id === id)?.name ?? '—';
	const availableRooms = (roomTypeId: string) =>
		rooms.filter((r) => r.room_type_id === roomTypeId && r.status === 'AVAILABLE');

	async function load() {
		loading = true;
		try {
			[reservations, roomTypes, rooms] = await Promise.all([listReservations(), listRoomTypes(), listRooms()]);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to load reservations');
		} finally {
			loading = false;
		}
	}

	onMount(load);

	function openCreate() {
		const today = new Date().toISOString().slice(0, 10);
		const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
		form = { room_type_id: roomTypes[0]?.id ?? '', check_in_date: today, check_out_date: tomorrow, guests: '1' };
		errors = {};
		formOpen = true;
	}

	async function submit() {
		const errs: Record<string, string> = {};
		if (!form.room_type_id) errs.room_type_id = 'Choose a room type';
		if (!form.check_in_date || !form.check_out_date) errs.check_in_date = 'Choose both dates';
		else if (form.check_out_date <= form.check_in_date) errs.check_in_date = 'Check-out must be after check-in';
		errors = errs;
		if (Object.keys(errs).length) return;

		saving = true;
		try {
			await createReservation({
				room_type_id: form.room_type_id,
				check_in_date: form.check_in_date,
				check_out_date: form.check_out_date,
				guests: Number(form.guests) || 1
			});
			toast.success('Reservation created');
			formOpen = false;
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not create reservation');
		} finally {
			saving = false;
		}
	}

	async function run(action: (id: string) => Promise<Reservation>, id: string, okMsg: string) {
		try {
			await action(id);
			toast.success(okMsg);
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Action failed');
		}
	}

	function openCheckIn(r: Reservation) {
		checkInTarget = r;
		checkInRoomId = availableRooms(r.room_type_id)[0]?.id ?? '';
		checkInOpen = true;
	}

	async function submitCheckIn() {
		if (!checkInTarget || !checkInRoomId) return;
		checkInSaving = true;
		try {
			await checkInReservation(checkInTarget.id, checkInRoomId);
			toast.success('Checked in');
			checkInOpen = false;
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not check in');
		} finally {
			checkInSaving = false;
		}
	}

	async function openFolio(r: Reservation) {
		folioReservation = r;
		folioOpen = true;
		folioLoading = true;
		chargeForm = { description: '', amount: '0' };
		try {
			const data = await getFolio(r.id);
			folioCharges = data.charges ?? [];
			folioTotal = data.total ?? 0;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'No folio yet — check in first');
			folioCharges = [];
			folioTotal = 0;
		} finally {
			folioLoading = false;
		}
	}

	async function submitCharge() {
		if (!folioReservation || !chargeForm.description.trim()) return;
		try {
			await addCharge(folioReservation.id, chargeForm.description.trim(), Number(chargeForm.amount) || 0);
			toast.success('Charge added');
			await openFolio(folioReservation);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not add charge');
		}
	}

	function actionsFor(r: Reservation) {
		switch (r.status) {
			case 'REQUESTED':
				return [
					{ label: 'Confirm', onclick: () => run(confirmReservation, r.id, 'Reservation confirmed') },
					{ label: 'Cancel', danger: true, onclick: () => run(cancelReservation, r.id, 'Reservation cancelled') }
				];
			case 'CONFIRMED':
				return [
					{ label: 'Check in', onclick: () => openCheckIn(r) },
					{ label: 'No-show', onclick: () => run(noShowReservation, r.id, 'Marked no-show') },
					{ label: 'Cancel', danger: true, onclick: () => run(cancelReservation, r.id, 'Reservation cancelled') }
				];
			case 'CHECKED_IN':
				return [
					{ label: 'View folio', onclick: () => openFolio(r) },
					{ label: 'Check out', onclick: () => run(checkOutReservation, r.id, 'Checked out') }
				];
			default:
				return [{ label: 'View folio', onclick: () => openFolio(r) }];
		}
	}

	function money(n: number): string {
		return `₹${n.toFixed(2)}`;
	}
</script>

<div class="res-page">
	<header class="res-head">
		<p class="muted">Bookings against a room type, assigned to a room at check-in.</p>
		<button type="button" class="btn btn-primary" onclick={openCreate} disabled={roomTypes.length === 0}>
			<Plus size={15} strokeWidth={2.2} />
			New reservation
		</button>
	</header>

	{#if !loading && roomTypes.length === 0}
		<div class="panel" style="padding:1rem;">
			<p class="muted" style="margin:0;">
				Add a room type first under <a href="/shop/rooms">Rooms</a> before taking reservations.
			</p>
		</div>
	{/if}

	<section class="panel panel-flush">
		<DataTable
			{loading}
			empty={!loading && reservations.length === 0}
			emptyTitle="No reservations yet"
			emptyDescription="Reservations appear here once created."
		>
			{#snippet head()}
				<th>Room type</th>
				<th>Check-in</th>
				<th>Check-out</th>
				<th>Guests</th>
				<th>Status</th>
				<th style="width:1%;"><span class="sr-only">Actions</span></th>
			{/snippet}
			{#each reservations as r (r.id)}
				<tr>
					<td><strong>{typeName(r.room_type_id)}</strong></td>
					<td class="muted">{r.check_in_date}</td>
					<td class="muted">{r.check_out_date}</td>
					<td class="muted">{r.guests}</td>
					<td><StatusBadge status={r.status} /></td>
					<td>
						<Menu label="Reservation actions" items={actionsFor(r)} />
					</td>
				</tr>
			{/each}
		</DataTable>
	</section>
</div>

<Modal bind:open={formOpen} title="New reservation">
	<div style="display:flex;flex-direction:column;gap:0.85rem;">
		<FormField label="Room type" htmlFor="res-type" required error={errors.room_type_id}>
			<SelectField
				id="res-type"
				bind:value={form.room_type_id}
				options={roomTypes.map((t) => ({ value: t.id, label: t.name }))}
			/>
		</FormField>
		<FormField label="Check-in" htmlFor="res-in" required error={errors.check_in_date}>
			<TextInput id="res-in" type="date" bind:value={form.check_in_date} />
		</FormField>
		<FormField label="Check-out" htmlFor="res-out" required>
			<TextInput id="res-out" type="date" bind:value={form.check_out_date} />
		</FormField>
		<FormField label="Guests" htmlFor="res-guests">
			<TextInput id="res-guests" type="number" min={1} bind:value={form.guests} />
		</FormField>
	</div>
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (formOpen = false)}>Cancel</button>
		<button type="button" class="btn btn-primary" disabled={saving} onclick={submit}>
			{saving ? 'Creating…' : 'Create'}
		</button>
	{/snippet}
</Modal>

<Modal bind:open={checkInOpen} title="Check in">
	<div style="display:flex;flex-direction:column;gap:0.85rem;">
		{#if checkInTarget && availableRooms(checkInTarget.room_type_id).length === 0}
			<p class="muted" style="margin:0;">No available rooms of this type right now.</p>
		{:else if checkInTarget}
			<FormField label="Room" htmlFor="checkin-room" required>
				<SelectField
					id="checkin-room"
					bind:value={checkInRoomId}
					options={availableRooms(checkInTarget.room_type_id).map((r) => ({ value: r.id, label: r.number }))}
				/>
			</FormField>
		{/if}
	</div>
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (checkInOpen = false)}>Cancel</button>
		<button type="button" class="btn btn-primary" disabled={checkInSaving || !checkInRoomId} onclick={submitCheckIn}>
			{checkInSaving ? 'Checking in…' : 'Check in'}
		</button>
	{/snippet}
</Modal>

<SlideOver bind:open={folioOpen} title="Folio">
	{#if folioLoading}
		<p class="muted">Loading…</p>
	{:else}
		<div style="display:flex;flex-direction:column;gap:1rem;">
			<div>
				<h3 style="margin:0 0 0.5rem;font-size:var(--fs-body);">Charges</h3>
				{#if folioCharges.length === 0}
					<p class="muted" style="margin:0;">No charges yet.</p>
				{:else}
					<ul style="list-style:none;margin:0;padding:0;display:grid;gap:0.4rem;">
						{#each folioCharges as c (c.id)}
							<li style="display:flex;justify-content:space-between;">
								<span>{c.description}</span>
								<span>{money(c.amount)}</span>
							</li>
						{/each}
					</ul>
				{/if}
				<p style="display:flex;justify-content:space-between;font-weight:700;margin-top:0.6rem;">
					<span>Total</span>
					<span>{money(folioTotal)}</span>
				</p>
			</div>
			<div style="display:flex;flex-direction:column;gap:0.6rem;">
				<FormField label="Add charge" htmlFor="charge-desc">
					<TextInput id="charge-desc" bind:value={chargeForm.description} placeholder="Room service" />
				</FormField>
				<FormField label="Amount" htmlFor="charge-amount">
					<TextInput id="charge-amount" type="number" min={0} step="0.01" bind:value={chargeForm.amount} />
				</FormField>
				<button
					type="button"
					class="btn btn-secondary"
					disabled={!chargeForm.description.trim()}
					onclick={submitCharge}
				>
					Add charge
				</button>
			</div>
		</div>
	{/if}
</SlideOver>

<style>
	.res-page {
		display: grid;
		gap: 1rem;
	}

	.res-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
</style>
