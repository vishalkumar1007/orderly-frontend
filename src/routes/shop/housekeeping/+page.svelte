<script lang="ts">
	import { onMount } from 'svelte';
	import Plus from '@tabler/icons-svelte/icons/plus';
	import {
		completeHousekeepingTask,
		createHousekeepingTask,
		listHousekeepingTasks,
		listRooms,
		type HousekeepingTask,
		type HousekeepingTaskType,
		type Room
	} from '$lib/tenant/hotelApi';
	import DataTable from '$lib/components/admin/DataTable.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import { toast } from '$lib/components/admin/toast';

	let tasks = $state<HousekeepingTask[]>([]);
	let rooms = $state<Room[]>([]);
	let loading = $state(true);
	let saving = $state(false);
	let roomId = $state('');
	let taskType = $state<HousekeepingTaskType>('CLEANING');

	const TASK_LABEL: Record<HousekeepingTaskType, string> = {
		CLEANING: 'Cleaning',
		INSPECTION: 'Inspection',
		MAINTENANCE: 'Maintenance'
	};

	const roomNumber = $derived(
		(id: string) => rooms.find((r) => r.id === id)?.number ?? '-'
	);

	async function load() {
		loading = true;
		try {
			[tasks, rooms] = await Promise.all([listHousekeepingTasks(), listRooms()]);
			if (!roomId && rooms.length > 0) roomId = rooms[0].id;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to load housekeeping');
		} finally {
			loading = false;
		}
	}

	onMount(load);

	async function add(e: SubmitEvent) {
		e.preventDefault();
		if (!roomId) return;
		saving = true;
		try {
			await createHousekeepingTask(roomId, taskType);
			toast.success(`${TASK_LABEL[taskType]} task added for room ${roomNumber(roomId)}`);
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not add the task');
		} finally {
			saving = false;
		}
	}

	async function complete(t: HousekeepingTask) {
		try {
			await completeHousekeepingTask(t.id);
			toast.success('Task done');
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not complete the task');
		}
	}
</script>

<div class="hk-page">
	<form class="hk-head" onsubmit={add}>
		<p class="muted">Cleaning, inspection and maintenance still open across the rooms.</p>
		<div class="hk-add">
			<select class="input" bind:value={roomId} aria-label="Room" required disabled={rooms.length === 0}>
				{#if rooms.length === 0}
					<option value="">No rooms yet</option>
				{/if}
				{#each rooms as r (r.id)}
					<option value={r.id}>Room {r.number}</option>
				{/each}
			</select>
			<select class="input" bind:value={taskType} aria-label="Task type">
				{#each Object.entries(TASK_LABEL) as [value, text] (value)}
					<option {value}>{text}</option>
				{/each}
			</select>
			<button type="submit" class="btn btn-primary" disabled={saving || !roomId}>
				<Plus size={15} stroke={1.6} />
				Add task
			</button>
		</div>
	</form>

	<section class="panel panel-flush">
		<DataTable
			{loading}
			empty={!loading && tasks.length === 0}
			emptyTitle="Nothing to do"
			emptyDescription="A check-out creates a cleaning task here. You can also add one by hand for any room."
		>
			{#snippet head()}
				<th>Room</th>
				<th>Task</th>
				<th>Status</th>
				<th style="width:1%;"><span class="sr-only">Actions</span></th>
			{/snippet}
			{#each tasks as t (t.id)}
				<tr>
					<td><strong>{roomNumber(t.room_id)}</strong></td>
					<td>{TASK_LABEL[t.task_type] ?? t.task_type}</td>
					<td><StatusBadge status={t.status} /></td>
					<td>
						{#if t.status !== 'DONE'}
							<button type="button" class="btn btn-sm btn-secondary" onclick={() => complete(t)}>
								Mark done
							</button>
						{/if}
					</td>
				</tr>
			{/each}
		</DataTable>
	</section>
</div>

<style>
	.hk-page {
		display: grid;
		gap: 1rem;
	}

	.hk-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.hk-add {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
</style>
