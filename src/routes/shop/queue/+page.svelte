<script lang="ts">
	import { onMount } from 'svelte';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import {
		callQueueEntry,
		cancelQueueEntry,
		completeQueueEntry,
		joinQueue,
		listQueue,
		startQueueEntry,
		type QueueEntry
	} from '$lib/tenant/queueApi';
	import DataTable from '$lib/components/admin/DataTable.svelte';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import { toast } from '$lib/components/admin/toast';

	let queue = $state<QueueEntry[]>([]);
	let loading = $state(true);
	let joining = $state(false);

	async function load() {
		loading = true;
		try {
			queue = await listQueue();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to load the queue');
		} finally {
			loading = false;
		}
	}

	onMount(load);

	async function addWalkIn() {
		joining = true;
		try {
			const entry = await joinQueue();
			toast.success(`Added — number ${entry.queue_number}`);
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not add to queue');
		} finally {
			joining = false;
		}
	}

	async function run(action: (id: string) => Promise<QueueEntry>, id: string, okMsg: string) {
		try {
			await action(id);
			toast.success(okMsg);
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Action failed');
		}
	}

	function actionsFor(e: QueueEntry) {
		switch (e.status) {
			case 'WAITING':
				return [
					{ label: 'Call', onclick: () => run(callQueueEntry, e.id, 'Called') },
					{ label: 'Cancel', danger: true, onclick: () => run(cancelQueueEntry, e.id, 'Removed from queue') }
				];
			case 'CALLED':
				return [
					{ label: 'Start service', onclick: () => run(startQueueEntry, e.id, 'In service') },
					{ label: 'Cancel', danger: true, onclick: () => run(cancelQueueEntry, e.id, 'Removed from queue') }
				];
			case 'IN_SERVICE':
				return [{ label: 'Complete', onclick: () => run(completeQueueEntry, e.id, 'Completed') }];
			default:
				return [];
		}
	}
</script>

<div class="queue-page">
	<header class="queue-head">
		<p class="muted">Today's walk-in line, called in order.</p>
		<button type="button" class="btn btn-primary" onclick={addWalkIn} disabled={joining}>
			<UserPlus size={15} strokeWidth={2.2} />
			Add walk-in
		</button>
	</header>

	<section class="panel panel-flush">
		<DataTable
			{loading}
			empty={!loading && queue.length === 0}
			emptyTitle="No one in the queue"
			emptyDescription="Walk-ins you add, and appointments checked in today, show up here."
		>
			{#snippet head()}
				<th>#</th>
				<th>Status</th>
				<th style="width:1%;"><span class="sr-only">Actions</span></th>
			{/snippet}
			{#each queue as e (e.id)}
				<tr>
					<td><strong class="queue-number">{e.queue_number}</strong></td>
					<td><StatusBadge status={e.status} /></td>
					<td>
						{#if actionsFor(e).length > 0}
							<div class="queue-actions">
								{#each actionsFor(e) as action (action.label)}
									<button
										type="button"
										class={['btn btn-sm', action.danger ? 'btn-ghost' : 'btn-secondary'].join(' ')}
										onclick={action.onclick}
									>
										{action.label}
									</button>
								{/each}
							</div>
						{/if}
					</td>
				</tr>
			{/each}
		</DataTable>
	</section>
</div>

<style>
	.queue-page {
		display: grid;
		gap: 1rem;
	}

	.queue-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.queue-number {
		font-size: 1.1rem;
	}

	.queue-actions {
		display: flex;
		gap: 0.4rem;
	}
</style>
