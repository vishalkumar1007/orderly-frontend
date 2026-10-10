<script lang="ts">
	import { onMount } from 'svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import {
		createRoom,
		createRoomType,
		deleteRoomType,
		listRoomTypes,
		listRooms,
		setRoomStatus,
		updateRoomType,
		type Room,
		type RoomStatus,
		type RoomType
	} from '$lib/tenant/hotelApi';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import DataTable from '$lib/components/admin/DataTable.svelte';
	import FormField from '$lib/components/admin/FormField.svelte';
	import Menu from '$lib/components/admin/Menu.svelte';
	import Modal from '$lib/components/admin/Modal.svelte';
	import SelectField from '$lib/components/admin/SelectField.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import TextInput from '$lib/components/admin/TextInput.svelte';
	import { toast } from '$lib/components/admin/toast';

	const ROOM_STATUSES: RoomStatus[] = [
		'AVAILABLE',
		'RESERVED',
		'OCCUPIED',
		'CHECKOUT_PENDING',
		'CLEANING',
		'INSPECTION'
	];

	let roomTypes = $state<RoomType[]>([]);
	let rooms = $state<Room[]>([]);
	let loading = $state(true);

	let typeFormOpen = $state(false);
	let editingType = $state<RoomType | null>(null);
	let typeForm = $state({ name: '', base_price: '0', max_guests: '2' });
	let typeErrors = $state<Record<string, string>>({});
	let typeSaving = $state(false);

	let deleteTarget = $state<RoomType | null>(null);
	let deleteOpen = $state(false);
	let deleteLoading = $state(false);

	let roomFormOpen = $state(false);
	let roomForm = $state({ room_type_id: '', number: '' });
	let roomErrors = $state<Record<string, string>>({});
	let roomSaving = $state(false);

	const typeName = (id: string) => roomTypes.find((t) => t.id === id)?.name ?? '—';

	async function load() {
		loading = true;
		try {
			[roomTypes, rooms] = await Promise.all([listRoomTypes(), listRooms()]);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to load rooms');
		} finally {
			loading = false;
		}
	}

	onMount(load);

	function openCreateType() {
		editingType = null;
		typeForm = { name: '', base_price: '0', max_guests: '2' };
		typeErrors = {};
		typeFormOpen = true;
	}

	function openEditType(t: RoomType) {
		editingType = t;
		typeForm = { name: t.name, base_price: String(t.base_price), max_guests: String(t.max_guests) };
		typeErrors = {};
		typeFormOpen = true;
	}

	async function submitType() {
		const errs: Record<string, string> = {};
		if (!typeForm.name.trim()) errs.name = 'Name is required';
		if (Number(typeForm.base_price) < 0) errs.base_price = 'Enter a price';
		typeErrors = errs;
		if (Object.keys(errs).length) return;

		typeSaving = true;
		try {
			const payload = {
				name: typeForm.name.trim(),
				base_price: Number(typeForm.base_price),
				max_guests: Number(typeForm.max_guests) || 2
			};
			if (editingType) {
				await updateRoomType(editingType.id, payload);
				toast.success('Room type updated');
			} else {
				await createRoomType(payload);
				toast.success('Room type added');
			}
			typeFormOpen = false;
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not save room type');
		} finally {
			typeSaving = false;
		}
	}

	function askDeleteType(t: RoomType) {
		deleteTarget = t;
		deleteOpen = true;
	}

	async function runDeleteType() {
		if (!deleteTarget) return;
		deleteLoading = true;
		try {
			await deleteRoomType(deleteTarget.id);
			deleteOpen = false;
			toast.success(`${deleteTarget.name} removed`);
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not remove room type');
		} finally {
			deleteLoading = false;
		}
	}

	function openCreateRoom() {
		roomForm = { room_type_id: roomTypes[0]?.id ?? '', number: '' };
		roomErrors = {};
		roomFormOpen = true;
	}

	async function submitRoom() {
		const errs: Record<string, string> = {};
		if (!roomForm.room_type_id) errs.room_type_id = 'Choose a room type';
		if (!roomForm.number.trim()) errs.number = 'Enter a room number';
		roomErrors = errs;
		if (Object.keys(errs).length) return;

		roomSaving = true;
		try {
			await createRoom(roomForm.room_type_id, roomForm.number.trim());
			toast.success('Room added');
			roomFormOpen = false;
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not add room');
		} finally {
			roomSaving = false;
		}
	}

	async function changeStatus(room: Room, status: RoomStatus) {
		try {
			await setRoomStatus(room.id, status);
			toast.success(`Room ${room.number} → ${status.replaceAll('_', ' ').toLowerCase()}`);
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not change room status');
		}
	}

	function money(n: number): string {
		return `₹${n.toFixed(2)}`;
	}
</script>

<div class="rooms-page">
	<section class="panel">
		<header class="rooms-section-head">
			<h2>Room types</h2>
			<button type="button" class="btn btn-secondary btn-sm" onclick={openCreateType}>
				<Plus size={14} strokeWidth={2.2} />
				Add room type
			</button>
		</header>
		<DataTable
			{loading}
			empty={!loading && roomTypes.length === 0}
			emptyTitle="No room types yet"
			emptyDescription="Add a room type before adding rooms."
		>
			{#snippet head()}
				<th>Name</th>
				<th>Base price</th>
				<th>Max guests</th>
				<th style="width:1%;"><span class="sr-only">Actions</span></th>
			{/snippet}
			{#each roomTypes as t (t.id)}
				<tr>
					<td><strong>{t.name}</strong></td>
					<td class="muted">{money(t.base_price)}</td>
					<td class="muted">{t.max_guests}</td>
					<td>
						<Menu
							label={`Actions for ${t.name}`}
							items={[
								{ label: 'Edit', onclick: () => openEditType(t) },
								{ label: 'Remove', danger: true, onclick: () => askDeleteType(t), separatorBefore: true }
							]}
						/>
					</td>
				</tr>
			{/each}
		</DataTable>
	</section>

	<section class="panel">
		<header class="rooms-section-head">
			<h2>Rooms</h2>
			<button type="button" class="btn btn-secondary btn-sm" onclick={openCreateRoom} disabled={roomTypes.length === 0}>
				<Plus size={14} strokeWidth={2.2} />
				Add room
			</button>
		</header>
		<DataTable
			{loading}
			empty={!loading && rooms.length === 0}
			emptyTitle="No rooms yet"
			emptyDescription="Add rooms under each room type."
		>
			{#snippet head()}
				<th>Room</th>
				<th>Type</th>
				<th>Status</th>
				<th style="width:1%;"><span class="sr-only">Actions</span></th>
			{/snippet}
			{#each rooms as r (r.id)}
				<tr>
					<td><strong>{r.number}</strong></td>
					<td class="muted">{typeName(r.room_type_id)}</td>
					<td><StatusBadge status={r.status} /></td>
					<td>
						<Menu
							label={`Change status for room ${r.number}`}
							items={ROOM_STATUSES.filter((s) => s !== r.status).map((s) => ({
								label: `Set ${s.replaceAll('_', ' ').toLowerCase()}`,
								onclick: () => changeStatus(r, s)
							}))}
						/>
					</td>
				</tr>
			{/each}
		</DataTable>
	</section>
</div>

<Modal bind:open={typeFormOpen} title={editingType ? 'Edit room type' : 'Add room type'}>
	<div style="display:flex;flex-direction:column;gap:0.85rem;">
		<FormField label="Name" htmlFor="rt-name" required error={typeErrors.name}>
			<TextInput id="rt-name" bind:value={typeForm.name} placeholder="Deluxe double" />
		</FormField>
		<FormField label="Base price (per night)" htmlFor="rt-price" required error={typeErrors.base_price}>
			<TextInput id="rt-price" type="number" min={0} step="0.01" bind:value={typeForm.base_price} />
		</FormField>
		<FormField label="Max guests" htmlFor="rt-guests">
			<TextInput id="rt-guests" type="number" min={1} bind:value={typeForm.max_guests} />
		</FormField>
	</div>
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (typeFormOpen = false)}>Cancel</button>
		<button type="button" class="btn btn-primary" disabled={typeSaving} onclick={submitType}>
			{typeSaving ? 'Saving…' : 'Save'}
		</button>
	{/snippet}
</Modal>

<Modal bind:open={roomFormOpen} title="Add room">
	<div style="display:flex;flex-direction:column;gap:0.85rem;">
		<FormField label="Room type" htmlFor="room-type" required error={roomErrors.room_type_id}>
			<SelectField
				id="room-type"
				bind:value={roomForm.room_type_id}
				options={roomTypes.map((t) => ({ value: t.id, label: t.name }))}
			/>
		</FormField>
		<FormField label="Room number" htmlFor="room-number" required error={roomErrors.number}>
			<TextInput id="room-number" bind:value={roomForm.number} placeholder="204" />
		</FormField>
	</div>
	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (roomFormOpen = false)}>Cancel</button>
		<button type="button" class="btn btn-primary" disabled={roomSaving} onclick={submitRoom}>
			{roomSaving ? 'Adding…' : 'Add'}
		</button>
	{/snippet}
</Modal>

<ConfirmDialog
	bind:open={deleteOpen}
	title="Remove room type?"
	message={deleteTarget ? `${deleteTarget.name} will no longer be offered.` : ''}
	confirmLabel="Remove"
	danger
	loading={deleteLoading}
	onconfirm={runDeleteType}
/>

<style>
	.rooms-page {
		display: grid;
		gap: 1rem;
	}

	.rooms-section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.rooms-section-head h2 {
		margin: 0;
		font-size: var(--fs-h3, 1rem);
	}
</style>
