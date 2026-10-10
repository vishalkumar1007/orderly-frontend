<script lang="ts">
	import { onMount } from 'svelte';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import { errorMessage } from '$lib/admin/errors';
	import { formatRelative } from '$lib/admin/format';
	import {
		fetchNotificationPage,
		platformNotifications,
		type Notification
	} from '$lib/notifications.svelte';
	import EmptyState from '$lib/components/admin/EmptyState.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';

	/**
	 * The bell's dropdown only ever shows the most recent window. This is the
	 * rest of it — every console notification this account has ever had.
	 */

	let items = $state<Notification[]>([]);
	let loading = $state(true);
	let loadingMore = $state(false);
	let error = $state('');
	let exhausted = $state(false);
	let filter = $state<'all' | 'unread'>('all');

	const visible = $derived(filter === 'unread' ? items.filter((n) => !n.read) : items);

	async function loadFirst() {
		loading = true;
		error = '';
		try {
			const data = await fetchNotificationPage('/api/v1/admin');
			items = data.notifications ?? [];
			exhausted = items.length < 50;
		} catch (err) {
			error = errorMessage(err, 'load notifications');
		} finally {
			loading = false;
		}
	}

	async function loadMore() {
		const last = items[items.length - 1];
		if (!last) return;
		loadingMore = true;
		try {
			const data = await fetchNotificationPage('/api/v1/admin', {
				id: last.id,
				createdAt: last.created_at
			});
			const page = data.notifications ?? [];
			items = [...items, ...page];
			if (page.length < 50) exhausted = true;
		} catch (err) {
			error = errorMessage(err, 'load more notifications');
		} finally {
			loadingMore = false;
		}
	}

	async function toggleRead(n: Notification) {
		items = items.map((x) => (x.id === n.id ? { ...x, read: !x.read } : x));
		try {
			await (n.read ? platformNotifications.markUnread(n.id) : platformNotifications.markRead(n.id));
		} catch {
			/* optimistic; a refresh of this page will reconcile */
		}
	}

	onMount(loadFirst);
</script>

<svelte:head>
	<title>Notifications</title>
</svelte:head>

<div class="page-head">
	<h1>Notifications</h1>
</div>

<div class="hist-tabs" role="tablist">
	<button type="button" class="hist-tab" class:active={filter === 'all'} onclick={() => (filter = 'all')}>
		All
	</button>
	<button
		type="button"
		class="hist-tab"
		class:active={filter === 'unread'}
		onclick={() => (filter = 'unread')}
	>
		Unread
	</button>
</div>

{#if error}
	<ErrorState message={error} onretry={loadFirst} />
{:else if loading}
	<div style="display:flex;flex-direction:column;gap:0.5rem;">
		{#each [1, 2, 3, 4, 5] as _, i (i)}
			<Skeleton height="3.2rem" />
		{/each}
	</div>
{:else if visible.length === 0}
	<EmptyState
		title={filter === 'unread' ? 'Nothing unread' : 'No notifications yet'}
		description="Business onboarding, subscription, security and operational events show up here."
	/>
{:else}
	<ul class="hist-list">
		{#each visible as n (n.id)}
			<li class="hist-row" class:unread={!n.read}>
				{#if n.priority === 'CRITICAL' || n.priority === 'HIGH'}
					<AlertTriangle
						size={14}
						strokeWidth={2}
						class="hist-icon {n.priority === 'CRITICAL' ? 'critical' : 'high'}"
					/>
				{:else}
					<span class="hist-dot" class:visible={!n.read} aria-hidden="true"></span>
				{/if}
				<div class="hist-body">
					<strong>{n.title}</strong>
					{#if n.body}<p>{n.body}</p>{/if}
					<span class="hist-time">{formatRelative(n.created_at)}</span>
				</div>
				<button type="button" class="btn btn-quiet btn-sm" onclick={() => toggleRead(n)}>
					{n.read ? 'Mark unread' : 'Mark read'}
				</button>
			</li>
		{/each}
	</ul>
	{#if !exhausted}
		<div style="text-align:center;margin-top:0.85rem;">
			<button type="button" class="btn btn-ghost btn-sm" disabled={loadingMore} onclick={loadMore}>
				{loadingMore ? 'Loading…' : 'Load more'}
			</button>
		</div>
	{/if}
{/if}

<style>
	.page-head {
		margin-bottom: 0.9rem;
	}

	.page-head h1 {
		margin: 0;
		font-size: 1.3rem;
	}

	.hist-tabs {
		display: flex;
		gap: 1rem;
		margin-bottom: 0.85rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.hist-tab {
		background: none;
		border: none;
		padding: 0.4rem 0.1rem 0.6rem;
		font-size: var(--fs-body);
		font-weight: 600;
		color: var(--text-3);
		cursor: pointer;
		border-bottom: 2px solid transparent;
	}

	.hist-tab.active {
		color: var(--text);
		border-bottom-color: var(--accent);
	}

	.hist-list {
		list-style: none;
		margin: 0;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.hist-row {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
		padding: 0.7rem 0.9rem;
		border-top: 1px solid var(--border-subtle);
		background: var(--surface-1);
	}

	.hist-row:first-child {
		border-top: none;
	}

	.hist-row.unread strong {
		font-weight: 650;
	}

	.hist-dot {
		flex-shrink: 0;
		width: 7px;
		height: 7px;
		border-radius: 999px;
		margin-top: 0.45rem;
		background: transparent;
	}

	.hist-dot.visible {
		background: var(--accent);
	}

	:global(.hist-icon) {
		flex-shrink: 0;
		margin-top: 0.3rem;
	}

	:global(.hist-icon.high) {
		color: var(--warn, #d97706);
	}

	:global(.hist-icon.critical) {
		color: var(--danger, #e5484d);
	}

	.hist-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.hist-body p {
		margin: 0;
		font-size: var(--fs-code);
		color: var(--text-2);
	}

	.hist-time {
		font-size: var(--fs-code);
		color: var(--text-3);
	}
</style>
