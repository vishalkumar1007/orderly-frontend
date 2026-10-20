import { api } from '$lib/api/client';
import type { TenantAdmin, UserInviteResult } from '$lib/admin/types';

export type ShopUser = TenantAdmin & { last_login_at?: string | null };

import type { BusinessRole } from './iamApi';

export type CreateShopUserPayload = {
	name: string;
	email: string;
	phone?: string;
	role: BusinessRole;
};

export type UpdateShopUserPayload = {
	name?: string;
	phone?: string;
	role?: BusinessRole;
	status?: 'ACTIVE' | 'DISABLED';
};

export async function listShopUsers(): Promise<ShopUser[]> {
	const data = await api<{ users: ShopUser[] }>('/api/v1/tenant/users');
	return data.users ?? [];
}

export async function createShopUser(payload: CreateShopUserPayload): Promise<UserInviteResult> {
	return api<UserInviteResult>('/api/v1/tenant/users', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

export async function updateShopUser(
	userId: string,
	payload: UpdateShopUserPayload
): Promise<ShopUser> {
	return api<ShopUser>(`/api/v1/tenant/users/${userId}`, {
		method: 'PATCH',
		body: JSON.stringify(payload)
	});
}

export async function resetShopUserAccess(userId: string): Promise<UserInviteResult> {
	return api<UserInviteResult>(`/api/v1/tenant/users/${userId}/reset-access`, { method: 'POST' });
}

export async function resendShopUserInvite(userId: string): Promise<UserInviteResult> {
	return api<UserInviteResult>(`/api/v1/tenant/users/${userId}/resend-invite`, { method: 'POST' });
}

/** Turns off a locked-out teammate's two-factor authentication. Never returns a secret or codes: there are none to return. */
export async function resetShopUserMFA(userId: string): Promise<void> {
	await api(`/api/v1/tenant/users/${userId}/reset-mfa`, { method: 'POST' });
}

export type LoginEvent = {
	action: 'tenant.login' | 'mfa.verify';
	result: 'SUCCESS' | 'FAILURE' | 'DENIED';
	ip: string;
	user_agent: string;
	at: string;
};

export type StaffSession = {
	id: string;
	ip: string;
	user_agent: string;
	last_active: string;
	expires_at: string;
};

/** Keys appear only when relevant to the business type and plan. */
export type StaffStats = {
	from: string;
	to: string;
	last_login_at?: string | null;
	orders_handled?: number;
	appointments_completed?: number;
	hours_worked?: number;
};

export async function listStaffLogins(userId: string, limit = 50): Promise<LoginEvent[]> {
	const d = await api<{ logins: LoginEvent[] }>(`/api/v1/tenant/users/${userId}/logins?limit=${limit}`);
	return d.logins ?? [];
}

export async function listStaffSessions(userId: string): Promise<StaffSession[]> {
	const d = await api<{ sessions: StaffSession[] }>(`/api/v1/tenant/users/${userId}/sessions`);
	return d.sessions ?? [];
}

export async function signOutStaffEverywhere(userId: string): Promise<void> {
	await api(`/api/v1/tenant/users/${userId}/sessions`, { method: 'DELETE' });
}

export function getStaffStats(userId: string, days = 30): Promise<StaffStats> {
	return api<StaffStats>(`/api/v1/tenant/users/${userId}/stats?days=${days}`);
}

/** "Chrome on macOS" from a raw user agent; falls back to "Unknown device". */
export function deviceLabel(ua: string): string {
	if (!ua) return 'Unknown device';
	const browser = /Edg\//.test(ua)
		? 'Edge'
		: /OPR\/|Opera/.test(ua)
			? 'Opera'
			: /Firefox\//.test(ua)
				? 'Firefox'
				: /Chrome\/|CriOS/.test(ua)
					? 'Chrome'
					: /Safari\//.test(ua)
						? 'Safari'
						: '';
	const os = /Android/.test(ua)
		? 'Android'
		: /iPhone|iPad|iPod/.test(ua)
			? 'iOS'
			: /Windows/.test(ua)
				? 'Windows'
				: /Mac OS X|Macintosh/.test(ua)
					? 'macOS'
					: /Linux|X11/.test(ua)
						? 'Linux'
						: '';
	if (browser && os) return `${browser} on ${os}`;
	return browser || os || 'Unknown device';
}
