import { api } from '$lib/api/client';

/**
 * Two-factor auth for the signed-in person's own account — works identically
 * for a tenant staff member or a platform console account, since both are the
 * same `users` row on the backend. See $lib/auth.ts for the login-time
 * challenge/verify and forced-enrollment steps this enrollment unlocks.
 */

export type MfaMethod = 'TOTP' | 'EMAIL_OTP';

export type MfaMethodStatus = { method: MfaMethod; last_used_at?: string };
export type MfaStatus = { enabled: boolean; available: boolean; methods: MfaMethodStatus[] };
export type MfaSetup = { secret: string; qr_code_data_uri: string; setup_token: string };
export type MfaConfirmResult = { recovery_codes?: string[] };

export async function fetchMfaStatus(): Promise<MfaStatus> {
	return api<MfaStatus>('/api/v1/auth/me/mfa/status');
}

export async function setupMfa(): Promise<MfaSetup> {
	return api<MfaSetup>('/api/v1/auth/me/mfa/setup', { method: 'POST' });
}

export async function confirmMfa(setupToken: string, code: string): Promise<MfaConfirmResult> {
	return api<MfaConfirmResult>('/api/v1/auth/me/mfa/confirm', {
		method: 'POST',
		body: JSON.stringify({ setup_token: setupToken, code })
	});
}

/** Removes one enrolled method, leaving any others (e.g. TOTP + Email OTP) in place. */
export async function removeMfaMethod(method: MfaMethod, password: string): Promise<void> {
	await api('/api/v1/auth/me/mfa/remove-method', {
		method: 'POST',
		body: JSON.stringify({ method, password })
	});
}

export async function requestEmailOtp(): Promise<void> {
	await api('/api/v1/auth/me/mfa/email/send', { method: 'POST' });
}

export async function confirmEmailOtp(code: string): Promise<MfaConfirmResult> {
	return api<MfaConfirmResult>('/api/v1/auth/me/mfa/email/confirm', {
		method: 'POST',
		body: JSON.stringify({ code })
	});
}

export async function regenerateRecoveryCodes(password: string): Promise<string[]> {
	const data = await api<{ recovery_codes: string[] }>('/api/v1/auth/me/mfa/recovery-codes/regenerate', {
		method: 'POST',
		body: JSON.stringify({ password })
	});
	return data.recovery_codes;
}

/* ------------------------------------------------------------------ *
 * Tenant MFA policy — a Tenant Admin's own mode/methods/enforcement/grace
 * settings, within whatever the Super Admin's business-profile permission
 * allows. See the Configuration tab on the Super Admin side for the
 * read-only view of the same policy.
 * ------------------------------------------------------------------ */

export type MfaPolicyMode = 'DISABLED' | 'OPTIONAL' | 'REQUIRED';
export type MfaEnforceScope = 'ALL_ADMINS' | 'SELECTED_ROLES';

export type TenantMfaPolicy = {
	allowed: boolean;
	mode: MfaPolicyMode;
	allowed_methods: MfaMethod[];
	enforce_scope: MfaEnforceScope;
	enforce_roles: string[] | null;
	grace_period_days: number;
};

export async function fetchTenantMfaPolicy(): Promise<TenantMfaPolicy> {
	return api<TenantMfaPolicy>('/api/v1/tenant/mfa-policy');
}

export async function updateTenantMfaPolicy(
	policy: Omit<TenantMfaPolicy, 'allowed'>
): Promise<TenantMfaPolicy> {
	return api<TenantMfaPolicy>('/api/v1/tenant/mfa-policy', {
		method: 'PUT',
		body: JSON.stringify(policy)
	});
}
