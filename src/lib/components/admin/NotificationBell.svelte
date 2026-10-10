<script lang="ts">
	import { onMount } from 'svelte';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import Bell from '@lucide/svelte/icons/bell';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Dot from '@lucide/svelte/icons/dot';
	import { formatRelative } from '$lib/admin/format';
	import { platformNotifications, tenantNotifications, type Notification } from '$lib/notifications.svelte';

	let { scope }: { scope: 'tenant' | 'admin' } = $props();

	const board = scope === 'admin' ? platformNotifications : tenantNotifications;
	const viewAllHref = scope === 'admin' ? '/superadmin/notifications/history' : '/shop/notifications';

	let open = $state(false);
	let filter = $state<'all' | 'unread'>('all');
	let rootEl = $state<HTMLDivElement | null>(null);
	let triggerEl = $state<HTMLButtonElement | null>(null);

	const visible = $derived(filter === 'unread' ? board.items.filter((n) => !n.read) : board.items);

	function toggle() {
		open = !open;
	}

	function close() {
		open = false;
	}

	function onItemClick(n: Notification) {
		void board.markRead(n.id);
		const href = typeof n.data?.order_id === 'string' ? '/shop/orders' : undefined;
		close();
		if (href) window.location.assign(href);
	}

	function toggleRead(e: MouseEvent, n: Notification) {
		e.stopPropagation();
		void (n.read ? board.markUnread(n.id) : board.markRead(n.id));
	}

	onMount(() => {
		board.acquire();
		const onDoc = (e: MouseEvent) => {
			if (open && !rootEl?.contains(e.target as Node)) close();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && open) close();
		};
		document.addEventListener('mousedown', onDoc);
		document.addEventListener('keydown', onKey);
		return () => {
			board.release();
			document.removeEventListener('mousedown', onDoc);
			document.removeEventListener('keydown', onKey);
		};
	});
</script>

<div class="notif-root" bind:this={rootEl}>
	<button
		type="button"
		class="btn btn-ghost notif-trigger"
		bind:this={triggerEl}
		aria-haspopup="true"
		aria-expanded={open}
		aria-label={board.unreadCount > 0 ? `Notifications, ${board.unreadCount} unread` : 'Notifications'}
		title="Notifications"
		onclick={toggle}
	>
		<Bell size={17} strokeWidth={2} />
		{#if board.unreadCount > 0}
			<span class="notif-dot" aria-hidden="true">{board.unreadCount > 9 ? '9+' : board.unreadCount}</span>
		{/if}
	</button>

	{#if open}
		<div class="notif-panel" role="dialog" aria-label="Notifications">
			<header class="notif-panel-head">
				<strong>Notifications</strong>
				{#if board.unreadCount > 0}
					<button type="button" class="notif-markall" onclick={() => board.markAllRead()}>
						Mark all read
					</button>
				{/if}
			</header>
			<div class="notif-tabs" role="tablist">
				<button
					type="button"
					role="tab"
					aria-selected={filter === 'all'}
					class="notif-tab"
					class:active={filter === 'all'}
					onclick={() => (filter = 'all')}
				>
					All
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={filter === 'unread'}
					class="notif-tab"
					class:active={filter === 'unread'}
					onclick={() => (filter = 'unread')}
				>
					Unread
				</button>
			</div>
			{#if board.loading && board.items.length === 0}
				<p class="notif-empty muted">Loading…</p>
			{:else if visible.length === 0}
				<div class="notif-empty">
					<CircleCheck size={18} strokeWidth={1.7} />
					<p class="muted">{filter === 'unread' ? 'Nothing unread' : "You're all caught up"}</p>
				</div>
			{:else}
				<ul class="notif-list">
					{#each visible as n (n.id)}
						<li>
							<button type="button" class="notif-item" class:unread={!n.read} onclick={() => onItemClick(n)}>
								{#if n.priority === 'CRITICAL' || n.priority === 'HIGH'}
									<AlertTriangle
										size={13}
										strokeWidth={2}
										class="notif-item-icon {n.priority === 'CRITICAL' ? 'critical' : 'high'}"
									/>
								{:else}
									<Dot
									size={13}
									strokeWidth={2}
									class={['notif-item-icon', !n.read ? 'visible' : ''].join(' ')}
								/>
								{/if}
								<span class="notif-item-body">
									<span class="notif-item-title">{n.title}</span>
									{#if n.body}<span class="notif-item-text">{n.body}</span>{/if}
									<span class="notif-item-time">{formatRelative(n.created_at)}</span>
								</span>
								<span
									class="notif-item-toggle"
									role="button"
									tabindex="0"
									title={n.read ? 'Mark unread' : 'Mark read'}
									onclick={(e) => toggleRead(e, n)}
									onkeydown={(e) => e.key === 'Enter' && toggleRead(e as unknown as MouseEvent, n)}
								>
									{n.read ? 'Mark unread' : 'Mark read'}
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
			<footer class="notif-panel-foot">
				<a href={viewAllHref} onclick={close}>View all</a>
			</footer>
		</div>
	{/if}
</div>

<style>
	.notif-root {
		position: relative;
	}

	.notif-trigger {
		position: relative;
	}

	.notif-dot {
		position: absolute;
		top: 2px;
		right: 2px;
		min-width: 15px;
		height: 15px;
		padding: 0 3px;
		border-radius: 999px;
		background: var(--danger, #e5484d);
		color: #fff;
		font-size: 10px;
		font-weight: 700;
		line-height: 15px;
		text-align: center;
	}

	.notif-panel {
		position: absolute;
		top: calc(100% + 0.5rem);
		right: 0;
		width: 22rem;
		max-width: calc(100vw - 2rem);
		max-height: 28rem;
		overflow-y: auto;
		background: var(--surface, #fff);
		border: 1px solid var(--border, #e5e5e5);
		border-radius: 0.75rem;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.14);
		z-index: 60;
	}

	.notif-panel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.7rem 0.9rem;
		border-bottom: 1px solid var(--border-subtle, #eee);
		position: sticky;
		top: 0;
		background: inherit;
	}

	.notif-markall {
		background: none;
		border: none;
		color: var(--accent-dark, #2563eb);
		font-size: var(--fs-code, 0.78rem);
		font-weight: 600;
		cursor: pointer;
		padding: 0;
	}

	.notif-tabs {
		display: flex;
		gap: 0.3rem;
		padding: 0.5rem 0.9rem 0;
	}

	.notif-tab {
		background: none;
		border: none;
		padding: 0.25rem 0.1rem 0.5rem;
		font-size: var(--fs-code, 0.78rem);
		font-weight: 600;
		color: var(--text-3, #999);
		cursor: pointer;
		border-bottom: 2px solid transparent;
	}

	.notif-tab.active {
		color: var(--text, #111);
		border-bottom-color: var(--accent, #3b82f6);
	}

	.notif-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		padding: 2rem 1rem;
		text-align: center;
	}

	.notif-list {
		list-style: none;
		margin: 0;
		padding: 0.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.notif-item {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		border-radius: 0.5rem;
		padding: 0.55rem 0.6rem;
		cursor: pointer;
		position: relative;
	}

	.notif-item:hover {
		background: var(--surface-hover, rgba(0, 0, 0, 0.04));
	}

	.notif-item:hover .notif-item-toggle {
		opacity: 1;
	}

	.notif-item.unread .notif-item-title {
		font-weight: 650;
	}

	:global(.notif-item-icon) {
		flex-shrink: 0;
		margin-top: 0.3rem;
		color: transparent;
	}

	:global(.notif-item-icon.visible) {
		color: var(--accent, #3b82f6);
	}

	:global(.notif-item-icon.high) {
		color: var(--warn, #d97706);
	}

	:global(.notif-item-icon.critical) {
		color: var(--danger, #e5484d);
	}

	.notif-item-body {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
		flex: 1;
	}

	.notif-item-title {
		font-size: var(--fs-body, 0.85rem);
	}

	.notif-item-text {
		font-size: var(--fs-code, 0.78rem);
		color: var(--text-2, #666);
	}

	.notif-item-time {
		font-size: var(--fs-code, 0.78rem);
		color: var(--text-3, #999);
	}

	.notif-item-toggle {
		flex-shrink: 0;
		opacity: 0;
		font-size: var(--fs-meta, 0.7rem);
		color: var(--accent-dark, #2563eb);
		align-self: center;
		transition: opacity 0.12s;
	}

	.notif-panel-foot {
		position: sticky;
		bottom: 0;
		padding: 0.55rem 0.9rem;
		border-top: 1px solid var(--border-subtle, #eee);
		background: inherit;
		text-align: center;
	}

	.notif-panel-foot a {
		font-size: var(--fs-code, 0.78rem);
		font-weight: 600;
		color: var(--accent-dark, #2563eb);
	}
</style>
