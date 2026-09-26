/**
 * Opening-hours presentation.
 *
 * The API decides whether the store is open and in which timezone; this module
 * only turns the raw schedule into rows a customer can read. Keeping the day
 * order and the wording in one place means the header badge, the home section
 * and the footer can never disagree about what "today" is.
 */

export const DAY_LABELS: Record<string, string> = {
	mon: 'Monday',
	tue: 'Tuesday',
	wed: 'Wednesday',
	thu: 'Thursday',
	fri: 'Friday',
	sat: 'Saturday',
	sun: 'Sunday'
};

export const DAY_SHORT: Record<string, string> = {
	mon: 'Mon',
	tue: 'Tue',
	wed: 'Wed',
	thu: 'Thu',
	fri: 'Fri',
	sat: 'Sat',
	sun: 'Sun'
};

export const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** DayKeys is re-exported so templates read as one call. */
export const DayLabels = DAY_LABELS;

export type HoursRow = {
	key: string;
	label: string;
	/** Pre-formatted ranges, e.g. "9:00 AM – 10:00 PM". Empty when closed. */
	ranges: string[];
	closed: boolean;
	isToday: boolean;
};

/**
 * `hoursRows` builds the weekly schedule for display.
 *
 * `today` is resolved in the tenant's timezone, not the browser's: a customer
 * ordering from a different timezone should still see the shop's own day.
 */
export function hoursRows(hours: {
	schedule: Record<string, string[]>;
	always_open: boolean;
	timezone: string;
}): HoursRow[] {
	if (hours.always_open) return [];
	const todayKey = todayIn(hours.timezone);
	return DAY_ORDER.map((key) => {
		const raw = hours.schedule?.[key] ?? [];
		const ranges = raw
			.map((pair) => {
				if (!Array.isArray(pair) || pair.length < 2) return '';
				return `${formatClock(pair[0])} – ${formatClock(pair[1])}`;
			})
			.filter(Boolean);
		return {
			key,
			label: DAY_SHORT[key] ?? key,
			ranges,
			closed: ranges.length === 0,
			isToday: key === todayKey
		};
	});
}

/** `todayIn` returns the current day key in a specific timezone. */
export function todayIn(timezone: string): string {
	// `en-GB` gives a 0=Sunday weekday, so a Monday-first index is
	// (weekday + 6) % 7. Computed with Intl so no timezone database is shipped.
	const formatter = new Intl.DateTimeFormat('en-GB', {
		weekday: 'short',
		timeZone: timezone || 'UTC'
	});
	const short = formatter.format(new Date()).toLowerCase();
	const map: Record<string, string> = {
		mon: 'mon',
		tue: 'tue',
		wed: 'wed',
		thu: 'thu',
		fri: 'fri',
		sat: 'sat',
		sun: 'sun'
	};
	return map[short] ?? 'mon';
}

/** `formatClock` turns "09:00" into "9 AM" for a customer-facing schedule. */
export function formatClock(value: string): string {
	const match = /^(\d{1,2}):(\d{2})$/.exec((value ?? '').trim());
	if (!match) return value ?? '';
	const hours = Number(match[1]);
	const minutes = match[2];
	const suffix = hours >= 12 ? 'PM' : 'AM';
	const display = hours % 12 === 0 ? 12 : hours % 12;
	// Minutes are only worth showing when they are not on the hour.
	return minutes === '00' ? `${display} ${suffix}` : `${display}:${minutes} ${suffix}`;
}
