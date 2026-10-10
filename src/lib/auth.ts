import { api, clearTokens, setTokens } from './api/client';
import type { MfaSetup } from './mfaApi';

/** The business a tenant token belongs to, as the API reports it on /me. */
export type HostTenant = {
	id: string;
	slug: string;
	name: string;
	setup_status: string;
	is_published: boolean;
	/** Drives the console's vocabulary and which modules it shows. */
	business_type: string;
};

export type User = {
	id: string;
	email: string;
	name: string;
	role: 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'MANAGER' | 'STAFF';
	tenant_id: string | null;
	status: string;
	must_set_password?: boolean;
	/** Human name for the role, e.g. "Manager". Supplied by the API. */
	role_label?: string;
	/**
	 * What this identity may reach, decided by the API. The console filters its
	 * navigation with this rather than with its own copy of the role table.
	 */
	permissions?: string[];
};

type AuthResponse = { tokens: Parameters<typeof setTokens>[0]; user: User };
type MfaChallengeResponse = { mfa_required: true; challenge_token: string; methods: string[] };
type MfaEnrollRequiredResponse = { mfa_enroll_required: true; enrollment_token: string; methods: string[] };
type LoginResult = AuthResponse | MfaChallengeResponse | MfaEnrollRequiredResponse;

/** What a password step can hand back: a signed-in user, or "one more step." */
export type MfaRequired = { mfaRequired: true; challengeToken: string; methods: string[] };
/** The account has zero enrolled methods and policy now requires one. */
export type MfaEnrollRequired = { mfaEnrollRequired: true; enrollmentToken: string; methods: string[] };

function isMfaChallenge(data: LoginResult): data is MfaChallengeResponse {
	return (data as MfaChallengeResponse).mfa_required === true;
}

function isMfaEnrollRequired(data: LoginResult): data is MfaEnrollRequiredResponse {
	return (data as MfaEnrollRequiredResponse).mfa_enroll_required === true;
}

export async function adminSetupStatus() {
	return api<{ needs_setup: boolean }>('/api/v1/auth/admin/setup-status', {}, false);
}

export async function adminSetup(email: string, password: string, name?: string) {
	return api<{ id: string; email: string }>(
		'/api/v1/auth/admin/setup',
		{
			method: 'POST',
			body: JSON.stringify({ email, password, ...(name ? { name } : {}) })
		},
		false
	);
}

function handleLoginResult(data: LoginResult): User | MfaRequired | MfaEnrollRequired {
	if (isMfaChallenge(data)) {
		return { mfaRequired: true, challengeToken: data.challenge_token, methods: data.methods ?? [] };
	}
	if (isMfaEnrollRequired(data)) {
		return { mfaEnrollRequired: true, enrollmentToken: data.enrollment_token, methods: data.methods ?? [] };
	}
	setTokens(data.tokens);
	return data.user;
}

export async function adminLogin(
	email: string,
	password: string
): Promise<User | MfaRequired | MfaEnrollRequired> {
	const data = await api<LoginResult>(
		'/api/v1/auth/admin/login',
		{ method: 'POST', body: JSON.stringify({ email, password }) },
		false
	);
	return handleLoginResult(data);
}

export async function tenantLogin(
	email: string,
	password: string
): Promise<User | MfaRequired | MfaEnrollRequired> {
	const data = await api<LoginResult>(
		'/api/v1/auth/tenant/login',
		{ method: 'POST', body: JSON.stringify({ email, password }) },
		false
	);
	return handleLoginResult(data);
}

/** Completes a login that returned `mfaRequired` — the second step. */
export async function verifyMfa(
	challengeToken: string,
	codeOrRecovery: string,
	isRecoveryCode = false,
	method?: 'TOTP' | 'EMAIL_OTP'
): Promise<User> {
	const data = await api<AuthResponse>(
		'/api/v1/auth/mfa/verify',
		{
			method: 'POST',
			body: JSON.stringify({
				challenge_token: challengeToken,
				...(method ? { method } : {}),
				...(isRecoveryCode ? { recovery_code: codeOrRecovery } : { code: codeOrRecovery })
			})
		},
		false
	);
	setTokens(data.tokens);
	return data.user;
}

/** Sends an Email OTP code during a login challenge (the user already has Email OTP enrolled). */
export async function sendChallengeEmailOtp(challengeToken: string): Promise<void> {
	await api(
		'/api/v1/auth/mfa/challenge/email/send',
		{ method: 'POST', body: JSON.stringify({ challenge_token: challengeToken }) },
		false
	);
}

export async function setupPassword(
	token: string,
	password: string
): Promise<User | MfaEnrollRequired> {
	const data = await api<AuthResponse | MfaEnrollRequiredResponse>(
		'/api/v1/auth/setup-password',
		{ method: 'POST', body: JSON.stringify({ token, password }) },
		false
	);
	if (isMfaEnrollRequired(data as LoginResult)) {
		const d = data as MfaEnrollRequiredResponse;
		return { mfaEnrollRequired: true, enrollmentToken: d.enrollment_token, methods: d.methods ?? [] };
	}
	const d = data as AuthResponse;
	setTokens(d.tokens);
	return d.user;
}

/**
 * Forced enrollment: the account has zero MFA methods and policy now
 * requires one, past its grace period. Each pair mirrors setup/confirm —
 * start returns a secret/QR (or sends an email code), confirm both enrolls
 * the method and completes the login the way verifyMfa does.
 */
export async function enrollMfaStart(enrollmentToken: string): Promise<MfaSetup> {
	return api<MfaSetup>(
		'/api/v1/auth/mfa/enroll/start',
		{ method: 'POST', body: JSON.stringify({ enrollment_token: enrollmentToken }) },
		false
	);
}

export async function enrollMfaConfirm(
	enrollmentToken: string,
	setupToken: string,
	code: string
): Promise<User> {
	const data = await api<AuthResponse>(
		'/api/v1/auth/mfa/enroll/confirm',
		{
			method: 'POST',
			body: JSON.stringify({ enrollment_token: enrollmentToken, setup_token: setupToken, code })
		},
		false
	);
	setTokens(data.tokens);
	return data.user;
}

export async function enrollMfaEmailSend(enrollmentToken: string): Promise<void> {
	await api(
		'/api/v1/auth/mfa/enroll/email/send',
		{ method: 'POST', body: JSON.stringify({ enrollment_token: enrollmentToken }) },
		false
	);
}

export async function enrollMfaEmailConfirm(enrollmentToken: string, code: string): Promise<User> {
	const data = await api<AuthResponse>(
		'/api/v1/auth/mfa/enroll/email/confirm',
		{ method: 'POST', body: JSON.stringify({ enrollment_token: enrollmentToken, code }) },
		false
	);
	setTokens(data.tokens);
	return data.user;
}

export async function me() {
	const data = await api<User | { user: User }>('/api/v1/auth/me', { timeoutMs: 5_000 });
	if (data && typeof data === 'object' && 'user' in data && data.user) {
		return data.user;
	}
	return data as User;
}

/**
 * The identity together with the business it was issued for.
 *
 * On a tenant host the API answers with both. The console needs the business
 * type before it draws anything — the rail's labels come from it — so this is
 * one call rather than a second round trip after the shell has rendered.
 */
export async function meWithTenant(): Promise<{ user: User; tenant: HostTenant | null }> {
	const data = await api<User | { user: User; host_tenant?: HostTenant }>(
		'/api/v1/auth/me',
		{ timeoutMs: 5_000 }
	);
	if (data && typeof data === 'object' && 'user' in data && data.user) {
		return { user: data.user, tenant: (data as { host_tenant?: HostTenant }).host_tenant ?? null };
	}
	return { user: data as User, tenant: null };
}

export async function changePassword(currentPassword: string, newPassword: string) {
	await api(
		'/api/v1/auth/me/password',
		{
			method: 'PUT',
			body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
		},
		true
	);
}

export async function logout() {
	const refresh = localStorage.getItem('orderly_refresh');
	try {
		await api(
			'/api/v1/auth/logout',
			{ method: 'POST', body: JSON.stringify({ refresh_token: refresh }) },
			false
		);
	} finally {
		clearTokens();
	}
}

export function homeForRole(role: string, hostKind: 'admin' | 'tenant' | 'unknown' = 'unknown'): string {
	if (role === 'SUPER_ADMIN') return '/superadmin';
	if (role === 'TENANT_ADMIN') return '/shop';
	if (role === 'STAFF') return '/shop/kitchen';
	if (hostKind === 'admin') return '/superadmin';
	if (hostKind === 'tenant') return '/';
	return '/shop/login';
}
