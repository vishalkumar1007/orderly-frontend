import { api, type ApiOptions } from '$lib/api/client';

export type Punch = {
	id: string;
	user_id: string;
	clock_in_at: string;
	clock_out_at: string | null;
	in_distance_m: number | null;
	out_distance_m: number | null;
	note: string;
	edited: boolean;
};

export type StaffPunch = Punch & { user_name: string; user_role: string };

export type AttendanceMe = {
	enabled: boolean;
	require_location: boolean;
	geo_radius_m: number;
	geo_lat: number | null;
	geo_lng: number | null;
	open: Punch | null;
	today_seconds: number;
};

export type AttendanceSettings = {
	enabled: boolean;
	require_location: boolean;
	geo_lat: number | null;
	geo_lng: number | null;
	geo_radius_m: number;
};

type Coords = { lat?: number; lng?: number; note?: string };

const B = '/api/v1/tenant/attendance';

export function getAttendanceMe(options?: ApiOptions): Promise<AttendanceMe> {
	return api<AttendanceMe>(`${B}/me`, options);
}

export function punchIn(body: Coords): Promise<Punch> {
	return api<Punch>(`${B}/punch-in`, { method: 'POST', body: JSON.stringify(body) });
}

export function punchOut(body: Coords): Promise<Punch> {
	return api<Punch>(`${B}/punch-out`, { method: 'POST', body: JSON.stringify(body) });
}

/** `to` is exclusive. Dates are local YYYY-MM-DD. */
export async function listAttendance(from: string, to: string, userId?: string): Promise<StaffPunch[]> {
	const q = new URLSearchParams({ from, to });
	if (userId) q.set('user_id', userId);
	const d = await api<{ punches: StaffPunch[] }>(`${B}?${q}`);
	return d.punches ?? [];
}

export function correctPunch(
	id: string,
	body: { clock_in_at: string; clock_out_at: string | null; note: string }
): Promise<Punch> {
	return api<Punch>(`${B}/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function getAttendanceSettings(): Promise<AttendanceSettings> {
	return api<AttendanceSettings>(`${B}/settings`);
}

export function saveAttendanceSettings(s: AttendanceSettings): Promise<AttendanceSettings> {
	return api<AttendanceSettings>(`${B}/settings`, { method: 'PUT', body: JSON.stringify(s) });
}

/** Local calendar date as YYYY-MM-DD. */
export function ymd(d: Date): string {
	const p = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Seconds a punch covers; open punches run to `now`. */
export function punchSeconds(p: Punch, now = Date.now()): number {
	const end = p.clock_out_at ? new Date(p.clock_out_at).getTime() : now;
	return Math.max(0, Math.round((end - new Date(p.clock_in_at).getTime()) / 1000));
}

/** "2h 14m" / "45m". */
export function formatDuration(sec: number): string {
	const m = Math.floor(sec / 60);
	const h = Math.floor(m / 60);
	return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

/** Browser position, rejecting with a plain-words Error on denial or timeout. */
export function getPosition(): Promise<{ lat: number; lng: number }> {
	return new Promise((resolve, reject) => {
		if (!('geolocation' in navigator)) {
			reject(new Error('This device cannot share its location'));
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
			(e) =>
				reject(
					new Error(
						e.code === 1
							? 'Location permission is blocked. Allow location for this site and try again'
							: 'Could not get your location. Try again'
					)
				),
			{ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
		);
	});
}
