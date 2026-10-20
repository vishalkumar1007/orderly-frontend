/**
 * Date and time helpers for booking and stays. Every date is a calendar day
 * in the business's own timezone (YYYY-MM-DD), never the customer's or the
 * server's, so "today" means the same day the business is having.
 */

/** The calendar date of `at` in `timezone`, as YYYY-MM-DD. */
export function dateIn(timezone: string, at: Date = new Date()): string {
	// en-CA formats as YYYY-MM-DD.
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: timezone || 'UTC',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(at);
}

/** `day` plus `n` calendar days. Pure date arithmetic, no timezone involved. */
export function addDays(day: string, n: number): string {
	const d = new Date(`${day}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
}

export type StripDay = { date: string; weekday: string; day: number; month: string; isToday: boolean };

/** The next `days` days starting today in the business's timezone. */
export function dateStrip(timezone: string, days: number, now: Date = new Date()): StripDay[] {
	const today = dateIn(timezone, now);
	return Array.from({ length: days }, (_, i) => {
		const date = addDays(today, i);
		const d = new Date(`${date}T12:00:00Z`);
		return {
			date,
			weekday: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }),
			day: d.getUTCDate(),
			month: d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
			isToday: i === 0
		};
	});
}

/** The wall-clock time of an instant in the business's timezone, e.g. "4:30 PM". */
export function clockIn(timezone: string, iso: string): string {
	return new Date(iso).toLocaleTimeString('en-IN', {
		timeZone: timezone || 'UTC',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});
}

/** A readable day for an instant or a YYYY-MM-DD date, e.g. "Tue 21 Oct". */
export function dayLabel(timezone: string, value: string): string {
	const d = value.length === 10 ? new Date(`${value}T12:00:00Z`) : new Date(value);
	return d.toLocaleDateString('en-GB', {
		timeZone: value.length === 10 ? 'UTC' : timezone || 'UTC',
		weekday: 'short',
		day: 'numeric',
		month: 'short'
	});
}

export type SlotGroup<T> = { label: 'Morning' | 'Afternoon' | 'Evening'; slots: T[] };

/** Splits start times into morning (before noon), afternoon (before 5 PM) and evening. */
export function groupSlots<T extends { start: string }>(slots: T[], timezone: string): SlotGroup<T>[] {
	const hourOf = (iso: string) =>
		Number(
			new Intl.DateTimeFormat('en-GB', { timeZone: timezone || 'UTC', hour: '2-digit', hour12: false }).format(
				new Date(iso)
			)
		) % 24;
	const groups: SlotGroup<T>[] = [
		{ label: 'Morning', slots: [] },
		{ label: 'Afternoon', slots: [] },
		{ label: 'Evening', slots: [] }
	];
	for (const s of slots) {
		const h = hourOf(s.start);
		groups[h < 12 ? 0 : h < 17 ? 1 : 2].slots.push(s);
	}
	return groups.filter((g) => g.slots.length > 0);
}

/** Nights between two YYYY-MM-DD dates; 0 when the range is empty or reversed. */
export function nights(checkIn: string, checkOut: string): number {
	if (!checkIn || !checkOut) return 0;
	const ms = Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`);
	return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 86_400_000) : 0;
}

/** Why a stay search cannot run, or '' when it can. */
export function stayRangeError(checkIn: string, checkOut: string, today: string, maxNights: number): string {
	if (!checkIn || !checkOut) return 'Choose your check-in and check-out dates.';
	if (checkIn < today) return 'Check-in cannot be in the past.';
	const n = nights(checkIn, checkOut);
	if (n < 1) return 'Check-out must be after check-in.';
	if (n > maxNights) return `Stays can be up to ${maxNights} nights.`;
	return '';
}

/** A minutes count as "45 min" or "1 hr 30 min". */
export function duration(minutes: number): string {
	if (minutes < 60) return `${minutes} min`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** A status code as customers read it. */
export function bookingStatus(status: string): string {
	const words: Record<string, string> = {
		REQUESTED: 'Requested',
		CONFIRMED: 'Confirmed',
		CHECKED_IN: 'Checked in',
		WAITING: 'Waiting',
		IN_SERVICE: 'In progress',
		COMPLETED: 'Completed',
		CHECKED_OUT: 'Checked out',
		CANCELLED: 'Cancelled',
		NO_SHOW: 'Missed'
	};
	return words[status] ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
}
