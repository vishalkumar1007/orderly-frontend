/**
 * Live Activity display settings.
 *
 * These live in the browser, not on the tenant record, and that is deliberate:
 * the setting belongs to the *screen*, not the business. A shop with a big TV
 * over the counter and a tablet by the door wants different things on each —
 * larger tickets on the TV, customer names only where the staff stand. Storing
 * one shared value on the server would force both devices to agree.
 *
 * Every read is guarded: a display in a kiosk profile can have storage blocked,
 * and the board must still render.
 */

const KEY = 'orderly-live-display';

export type TicketSize = 'comfortable' | 'large';

export type LiveDisplaySettings = {
	/** Paused blanks the board with a notice, for when the shop is closed. */
	paused: boolean;
	showPreparing: boolean;
	showReady: boolean;
	/** First name only — a pickup screen is a public display. */
	showCustomerName: boolean;
	/** Minutes since the order arrived, for customers judging the queue. */
	showWaitTime: boolean;
	ticketSize: TicketSize;
};

export function defaultLiveDisplay(): LiveDisplaySettings {
	return {
		paused: false,
		showPreparing: true,
		showReady: true,
		showCustomerName: false,
		showWaitTime: false,
		ticketSize: 'comfortable'
	};
}

/** Reactive settings, shared by the board and its controls. */
export const liveDisplay = $state<LiveDisplaySettings>(defaultLiveDisplay());

/** Load the saved settings for this device. Safe to call more than once. */
export function loadLiveDisplay(): void {
	if (typeof localStorage === 'undefined') return;
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return;
		const parsed = JSON.parse(raw) as Partial<LiveDisplaySettings>;
		Object.assign(liveDisplay, defaultLiveDisplay(), parsed);
		// At least one column, or the display is a blank rectangle that looks
		// broken rather than configured.
		if (!liveDisplay.showPreparing && !liveDisplay.showReady) {
			liveDisplay.showReady = true;
		}
	} catch {
		/* blocked or corrupt storage — the defaults are already in place */
	}
}

export function saveLiveDisplay(): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(KEY, JSON.stringify(liveDisplay));
	} catch {
		/* the choice simply will not survive a reload on this device */
	}
}

/** Toggle a column while keeping at least one visible. */
export function setColumn(column: 'preparing' | 'ready', visible: boolean): void {
	if (column === 'preparing') {
		liveDisplay.showPreparing = visible;
		if (!visible && !liveDisplay.showReady) liveDisplay.showReady = true;
	} else {
		liveDisplay.showReady = visible;
		if (!visible && !liveDisplay.showPreparing) liveDisplay.showPreparing = true;
	}
	saveLiveDisplay();
}

/** The first name only, for a screen the whole queue can read. */
export function publicName(fullName: string): string {
	const first = (fullName ?? '').trim().split(/\s+/)[0] ?? '';
	if (first.length <= 1) return first.toUpperCase();
	return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/** Whole minutes since an ISO timestamp, or null when it is unusable. */
export function minutesSince(iso?: string): number | null {
	if (!iso) return null;
	const then = new Date(iso).getTime();
	if (Number.isNaN(then)) return null;
	const minutes = Math.floor((Date.now() - then) / 60_000);
	return minutes < 0 ? null : minutes;
}
