import { api, clearTokens, setTokens } from './api/client';

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

export async function adminLogin(email: string, password: string) {
	const data = await api<AuthResponse>(
		'/api/v1/auth/admin/login',
		{ method: 'POST', body: JSON.stringify({ email, password }) },
		false
	);
	setTokens(data.tokens);
	return data.user;
}

export async function tenantLogin(email: string, password: string) {
	const data = await api<AuthResponse>(
		'/api/v1/auth/tenant/login',
		{ method: 'POST', body: JSON.stringify({ email, password }) },
		false
	);
	setTokens(data.tokens);
	return data.user;
}

export async function setupPassword(token: string, password: string) {
	const data = await api<AuthResponse>(
		'/api/v1/auth/setup-password',
		{ method: 'POST', body: JSON.stringify({ token, password }) },
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
