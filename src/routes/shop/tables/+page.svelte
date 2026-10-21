<script lang="ts">
	import { onMount } from 'svelte';
	import Plus from '@tabler/icons-svelte/icons/plus';
	import {
		createTable,
		deleteTable,
		listTables,
		setTableStatus,
		TABLE_TRANSITIONS,
		type DiningTable,
		type TableStatus
	} from '$lib/tenant/tablesApi';
	import DataTable from '$lib/components/admin/DataTable.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import { toast } from '$lib/components/admin/toast';

	let tables = $state<DiningTable[]>([]);
	let loading = $state(true);
	let saving = $state(false);
	let label = $state('');
	let seats = $state(2);

	const MOVE_LABEL: Record<TableStatus, string> = {
		AVAILABLE: 'Free up',
		RESERVED: 'Reserve',
		OCCUPIED: 'Seat guests',
		CLEANING: 'Needs cleaning'
	};

	async function load() {
		loading = true;
		try {
			tables = await listTables();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to load tables');
		} finally {
			loading = false;
		}
	}

	onMount(load);

	async function add(e: SubmitEvent) {
		e.preventDefault();
		if (!label.trim()) return;
		saving = true;
		try {
			await createTable(label.trim(), seats);
			toast.success(`Added table ${label.trim()}`);
			label = '';
			seats = 2;
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not add the table');
		} finally {
			saving = false;
		}
	}

	async function move(t: DiningTable, status: TableStatus) {
		try {
			await setTableStatus(t.id, status);
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not update the table');
		}
	}

	async function remove(t: DiningTable) {
		try {
			await deleteTable(t.id);
			toast.success(`Removed table ${t.label}`);
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not remove the table');
		}
	}
</script>

<div class="tables-page">
	<form class="tables-head" onsubmit={add}>
		<p class="muted">Dine-in tables and where each one is right now.</p>
		<div class="tables-add">
			<input
				class="input"
				type="text"
				placeholder="Label, e.g. T1 or Window"
				bind:value={label}
				required
				maxlength="40"
			/>
			<input class="input input-seats" type="number" min="1" max="99" bind:value={seats} aria-label="Seats" />
			<button type="submit" class="btn btn-primary" disabled={saving || !label.trim()}>
				<Plus size={15} stroke={1.6} />
				Add table
			</button>
		</div>
	</form>

	<section class="panel panel-flush">
		<DataTable
			{loading}
			empty={!loading && tables.length === 0}
			emptyTitle="No tables yet"
			emptyDescription="Add the tables guests can be seated at. Each one tracks whether it is free, reserved, occupied or being cleaned."
		>
			{#snippet head()}
				<th>Table</th>
				<th>Seats</th>
				<th>Status</th>
				<th style="width:1%;"><span class="sr-only">Actions</span></th>
			{/snippet}
			{#each tables as t (t.id)}
				<tr>
					<td><strong>{t.label}</strong></td>
					<td>{t.seats}</td>
					<td><StatusBadge status={t.status} /></td>
					<td>
						<div class="tables-actions">
							{#each TABLE_TRANSITIONS[t.status] ?? [] as next (next)}
								<button type="button" class="btn btn-sm btn-secondary" onclick={() => move(t, next)}>
									{MOVE_LABEL[next]}
								</button>
							{/each}
							{#if t.status === 'AVAILABLE'}
								<button type="button" class="btn btn-sm btn-ghost" onclick={() => remove(t)}>Remove</button>
							{/if}
						</div>
					</td>
				</tr>
			{/each}
		</DataTable>
	</section>
</div>

<style>
	.tables-page {
		display: grid;
		gap: 1rem;
	}

	.tables-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.tables-add {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.input-seats {
		width: 5rem;
	}

	.tables-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
</style>
