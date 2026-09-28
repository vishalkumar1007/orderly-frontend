import { api } from '$lib/api/client';
import type { TenantAdmin, UserInviteResult } from '$lib/admin/types';

export type ShopUser = TenantAdmin;

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
