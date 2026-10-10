import { api, ApiClientError, getAccessToken, getRefreshToken } from '$lib/api/client';
import { playSound } from '$lib/sound';
import { toast } from '$lib/components/admin/toast';

export type Notification = {
	id: string;
	type: string;
	title: string;
	body: string;
	data: Record<string, unknown> | null;
	read: boolean;
	priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
	event_code?: string;
	created_at: string;
};

const POLL_MS = 25_000;
const BACKOFF_START_MS = 10_000;
const BACKOFF_CAP_MS = 120_000;

// A per-viewer convenience, not shared state: whether the bell plays a sound
// for a new high-priority arrival. Defaults on; stored per browser, same as
// any other personal UI preference that does not need to survive a device
// change.
const SOUND_PREF_KEY = 'orderly-notif-sound-enabled';

export function soundEnabled(): boolean {
	try {
		const v = localStorage.getItem(SOUND_PREF_KEY);
		return v === null ? true : v === 'true';
	} catch {
		return true;
	}
}

export function setSoundEnabled(on: boolean): void {
	try {
		localStorage.setItem(SOUND_PREF_KEY, String(on));
	} catch {
		/* private window / blocked storage: the toggle just won't persist */
	}
}

/**
 * One polling feed, shared by every mounted bell for a given scope (tenant or
 * platform). Modeled on `$lib/tenant/orders.svelte.ts`'s `OrderBoard` —
 * acquire/release reference counting, visibility pause, error backoff — but
 * single-mode: the bell has no fast/slow split, it is always "background."
 */
function createNotificationBoard(basePath: '/api/v1/tenant' | '/api/v1/admin') {
	let items = $state<Notification[]>([]);
	let unreadCount = $state(0);
	let loading = $state(true);

	let subscribers = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let onVisibility: (() => void) | undefined;
	let inflight = false;
	let backoffMs = 0;
	let authStopped = false;
	// Every id ever sounded/toasted for this board, so a new poll that still
	// includes an item never re-announces it — only a genuinely new id does.
	const announced = new Set<string>();
	let firstLoad = true;

	function schedule() {
		stopTimer();
		if (subscribers === 0 || authStopped) return;
		if (typeof document !== 'undefined' && document.hidden) return;
		timer = setTimeout(() => void refresh(), backoffMs > 0 ? backoffMs : POLL_MS);
	}

	function stopTimer() {
		if (timer) clearTimeout(timer);
		timer = undefined;
	}

	async function refresh() {
		if (inflight) return;
		if (authStopped) return;
		if (!getAccessToken() && !getRefreshToken()) {
			authStopped = true;
			loading = false;
			stopTimer();
			return;
		}
		inflight = true;
		try {
			const data = await api<{ notifications: Notification[]; unread_count: number }>(
				`${basePath}/notifications`
			);
			const next = data.notifications ?? [];
			announceNewArrivals(next);
			items = next;
			unreadCount = data.unread_count ?? 0;
			backoffMs = 0;
			authStopped = false;
		} catch (err) {
			if (err instanceof ApiClientError && err.status === 401) {
				authStopped = true;
				stopTimer();
			} else {
				backoffMs = backoffMs === 0 ? BACKOFF_START_MS : Math.min(backoffMs * 2, BACKOFF_CAP_MS);
			}
		} finally {
			inflight = false;
			loading = false;
			schedule();
		}
	}

	// Sounds and toasts only for a HIGH/CRITICAL item that is both unread and
	// new since the last poll — never for the initial load (that would sound
	// off for a backlog from before this tab was open) and never twice for
	// the same id.
	function announceNewArrivals(next: Notification[]) {
		if (firstLoad) {
			firstLoad = false;
			for (const n of next) announced.add(n.id);
			return;
		}
		for (const n of next) {
			if (announced.has(n.id)) continue;
			announced.add(n.id);
			if (n.read) continue;
			if (n.priority !== 'HIGH' && n.priority !== 'CRITICAL') continue;
			if (soundEnabled()) playSound('CHIME');
			toast[n.priority === 'CRITICAL' ? 'error' : 'info'](n.title);
		}
	}

	function acquire() {
		subscribers += 1;
		if (subscribers === 1) {
			authStopped = false;
			backoffMs = 0;
			if (typeof document !== 'undefined') {
				onVisibility = () => {
					if (!document.hidden) void refresh();
					else stopTimer();
				};
				document.addEventListener('visibilitychange', onVisibility);
			}
			void refresh();
		}
	}

	function release() {
		subscribers = Math.max(0, subscribers - 1);
		if (subscribers === 0) {
			stopTimer();
			if (onVisibility && typeof document !== 'undefined') {
				document.removeEventListener('visibilitychange', onVisibility);
				onVisibility = undefined;
			}
		}
	}

	async function markRead(id: string) {
		const target = items.find((n) => n.id === id);
		if (!target || target.read) return;
		// Optimistic: the bell should feel instant, and a failed mark-read is
		// reconciled on the next poll regardless.
		items = items.map((n) => (n.id === id ? { ...n, read: true } : n));
		unreadCount = Math.max(0, unreadCount - 1);
		try {
			await api(`${basePath}/notifications/${id}/read`, { method: 'POST' });
		} catch {
			void refresh();
		}
	}

	async function markUnread(id: string) {
		const target = items.find((n) => n.id === id);
		if (!target || !target.read) return;
		items = items.map((n) => (n.id === id ? { ...n, read: false } : n));
		unreadCount = unreadCount + 1;
		try {
			await api(`${basePath}/notifications/${id}/unread`, { method: 'POST' });
		} catch {
			void refresh();
		}
	}

	async function markAllRead() {
		const hadUnread = items.some((n) => !n.read);
		if (!hadUnread) return;
		items = items.map((n) => ({ ...n, read: true }));
		unreadCount = 0;
		try {
			await api(`${basePath}/notifications/read-all`, { method: 'POST' });
		} catch {
			void refresh();
		}
	}

	return {
		get items() {
			return items;
		},
		get unreadCount() {
			return unreadCount;
		},
		get loading() {
			return loading;
		},
		acquire,
		release,
		refresh,
		markRead,
		markUnread,
		markAllRead
	};
}

export const tenantNotifications = createNotificationBoard('/api/v1/tenant');
export const platformNotifications = createNotificationBoard('/api/v1/admin');

/** One page of older history, for the bell's "view all" screen — independent
 * of the live board above, which only ever holds the most recent window. */
export async function fetchNotificationPage(
	basePath: '/api/v1/tenant' | '/api/v1/admin',
	before?: { id: string; createdAt: string }
): Promise<{ notifications: Notification[]; unread_count: number }> {
	const qs = before
		? `?before_id=${encodeURIComponent(before.id)}&before_created_at=${encodeURIComponent(before.createdAt)}`
		: '';
	return api(`${basePath}/notifications${qs}`);
}

export async function markNotificationRead(
	basePath: '/api/v1/tenant' | '/api/v1/admin',
	id: string
): Promise<void> {
	await api(`${basePath}/notifications/${id}/read`, { method: 'POST' });
}

export async function markNotificationUnread(
	basePath: '/api/v1/tenant' | '/api/v1/admin',
	id: string
): Promise<void> {
	await api(`${basePath}/notifications/${id}/unread`, { method: 'POST' });
}
