import { api } from '$lib/api/client';
import type { BrandTheme, ThemePreset } from '$lib/brandTheme';
import type {
	AuditLog,
	CreateTenantPayload,
	CreatedTenant,
	DashboardData,
	PlatformSettings,
	PlatformUser,
	PlanOption,
	UserInviteResult,
	Tenant,
	TenantAdmin,
	TenantMetrics,
	TenantType
} from './types';

type AdminDashboardResponse = {
	total_tenants: number;
	active_tenants: number;
	suspended_tenants: number;
	trial_tenants: number;
	total_orders: number;
	total_revenue: string;
	orders_today: number;
	order_value_today: string;
	active_users: number;
	pending_setup?: number;
	orders_by_day: { day: string; order_count: number; revenue: string }[];
	tenants_by_week: { week_start: string; tenant_count: number }[];
	recent_activity: AuditLog[];
};

function tenantActivityFromList(tenants: Tenant[]): DashboardData['recently_created'] {
	return tenants.slice(0, 5).map((t) => ({
		id: t.id,
		name: t.name,
		slug: t.slug,
		status: t.status,
		plan: t.plan,
		at: t.created_at || ''
	}));
}

export async function fetchDashboard(): Promise<DashboardData & AdminDashboardResponse> {
	const live = await api<AdminDashboardResponse>('/api/v1/admin/dashboard');
	const tenantData = await api<{ tenants: Tenant[] }>('/api/v1/admin/tenants');
	const tenants = tenantData.tenants;
	const suspended = tenants.filter((t) => t.status === 'SUSPENDED').slice(0, 5);
	const active = tenants.filter((t) => t.status === 'ACTIVE').slice(0, 5);

	return {
		...live,
		overview: {
			total_tenants: live.total_tenants,
			active_tenants: live.active_tenants,
			pending_setup: live.pending_setup ?? 0,
			suspended_tenants: live.suspended_tenants,
			trial_tenants: live.trial_tenants ?? 0
		},
		business: {
			total_orders: live.total_orders,
			orders_today: live.orders_today,
			revenue: live.total_revenue,
			order_value_today: live.order_value_today ?? '0',
			active_users: live.active_users
		},
		recently_created: tenantActivityFromList(tenants),
		recently_active: tenantActivityFromList(active),
		recently_suspended: tenantActivityFromList(suspended),
		platform_events: live.recent_activity,
		system_health: []
	};
}

export async function fetchTenants(): Promise<Tenant[]> {
	const data = await api<{ tenants: Tenant[] }>('/api/v1/admin/tenants');
	return data.tenants;
}

export async function fetchTenant(id: string): Promise<Tenant> {
	return api<Tenant>(`/api/v1/admin/tenants/${id}`);
}

export async function fetchTenantAdmins(id: string): Promise<TenantAdmin[]> {
	const data = await api<{ admins: TenantAdmin[] }>(`/api/v1/admin/tenants/${id}/admins`);
	return data.admins;
}

/** Every user on a tenant, admins and staff. */
export async function fetchTenantUsers(id: string): Promise<TenantAdmin[]> {
	const data = await api<{ users: TenantAdmin[] }>(`/api/v1/admin/tenants/${id}/users`);
	return data.users;
}

export type CreateUserPayload = {
	name: string;
	email: string;
	phone?: string;
	role: 'TENANT_ADMIN' | 'STAFF';
};

export async function createTenantUser(
	tenantId: string,
	payload: CreateUserPayload
): Promise<UserInviteResult> {
	return api<UserInviteResult>(`/api/v1/admin/tenants/${tenantId}/users`, {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

export type UpdateUserPayload = {
	name?: string;
	phone?: string;
	role?: 'TENANT_ADMIN' | 'STAFF';
	status?: 'ACTIVE' | 'DISABLED';
};

export async function updateTenantUser(
	tenantId: string,
	userId: string,
	payload: UpdateUserPayload
): Promise<TenantAdmin> {
	return api<TenantAdmin>(`/api/v1/admin/tenants/${tenantId}/users/${userId}`, {
		method: 'PATCH',
		body: JSON.stringify(payload)
	});
}

/** Force a new password and revoke every session the user holds. */
export async function resetUserAccess(
	tenantId: string,
	userId: string
): Promise<UserInviteResult> {
	return api<UserInviteResult>(
		`/api/v1/admin/tenants/${tenantId}/users/${userId}/reset-access`,
		{ method: 'POST' }
	);
}

export async function resendUserInvite(
	tenantId: string,
	userId: string
): Promise<UserInviteResult> {
	return api<UserInviteResult>(
		`/api/v1/admin/tenants/${tenantId}/users/${userId}/resend-invite`,
		{ method: 'POST' }
	);
}

export async function fetchTenantMetrics(id: string): Promise<TenantMetrics> {
	return api<TenantMetrics>(`/api/v1/admin/tenants/${id}/metrics`);
}

/** @deprecated use fetchTenantMetrics */
export async function fetchTenantExtras(id: string): Promise<TenantMetrics> {
	return fetchTenantMetrics(id);
}

export async function createTenant(payload: CreateTenantPayload): Promise<CreatedTenant> {
	return api<CreatedTenant>('/api/v1/admin/tenants', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

export async function setTenantStatus(
	id: string,
	action: 'activate' | 'suspend'
): Promise<Tenant> {
	return api<Tenant>(`/api/v1/admin/tenants/${id}/${action}`, { method: 'POST' });
}

export async function updateTenantLocal(id: string, patch: Partial<Tenant>): Promise<Tenant> {
	return api<Tenant>(`/api/v1/admin/tenants/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(patch)
	});
}

export async function fetchUsers(): Promise<PlatformUser[]> {
	const data = await api<{ users: PlatformUser[] }>('/api/v1/admin/users');
	return data.users;
}

type ApiPlan = {
	id: string;
	name: string;
	description?: string;
	price: number;
	max_staff?: number;
	max_products?: number;
};

/** Plans the platform currently offers, cheapest first (backend orders by price). */
export async function fetchPlans(): Promise<PlanOption[]> {
	const data = await api<{ plans: ApiPlan[] }>('/api/v1/admin/plans');
	return data.plans.map((p) => ({
		id: p.id,
		// The backend matches on the exact upper-case name — send `code`, never `name`.
		code: p.name.toUpperCase(),
		label: p.name.charAt(0) + p.name.slice(1).toLowerCase(),
		description: p.description ?? '',
		price: Number(p.price) || 0,
		maxStaff: p.max_staff ?? null,
		maxProducts: p.max_products ?? null
	}));
}

export async function fetchAuditLogs(
	tenantId?: string,
	result?: string
): Promise<AuditLog[]> {
	const params = new URLSearchParams();
	if (tenantId) params.set('tenant_id', tenantId);
	if (result) params.set('result', result);
	const q = params.toString();
	const data = await api<{ audit_logs: AuditLog[] }>(`/api/v1/admin/audit-logs${q ? `?${q}` : ''}`);
	return data.audit_logs;
}

export async function fetchSettings(): Promise<PlatformSettings> {
	return api<PlatformSettings>('/api/v1/admin/settings');
}

export type SettingsPatch = {
	general?: Partial<PlatformSettings['general']>;
	security?: Partial<PlatformSettings['security']>;
	platform?: Partial<Pick<PlatformSettings['platform'], 'allow_self_serve' | 'maintenance_mode'>>;
};

export async function updateSettings(patch: SettingsPatch): Promise<PlatformSettings> {
	return api<PlatformSettings>('/api/v1/admin/settings', {
		method: 'PATCH',
		body: JSON.stringify(patch)
	});
}

export async function checkSlugAvailable(slug: string) {
	return api<{ available: boolean; slug: string; reason?: string }>(
		`/api/v1/admin/tenants/slug-available?slug=${encodeURIComponent(slug)}`
	);
}

export async function resendTenantInvite(tenantId: string) {
	return api<{
		admin_email: string;
		invite_token: string;
		setup_path: string;
		setup_url: string;
		login_url: string;
		tenant_url: string;
		email_sent?: boolean;
		email_error?: string;
	}>(`/api/v1/admin/tenants/${tenantId}/resend-invite`, { method: 'POST' });
}

export async function fetchThemePresets(): Promise<ThemePreset[]> {
	const data = await api<{ presets: ThemePreset[] }>('/api/v1/admin/theme-presets');
	return data.presets;
}

export async function fetchTenantTypes(): Promise<TenantType[]> {
	const data = await api<{ types: TenantType[] }>('/api/v1/admin/tenant-types');
	return data.types;
}

export async function createTenantType(payload: {
	code: string;
	label: string;
	active?: boolean;
	sort_order?: number;
}): Promise<TenantType> {
	return api<TenantType>('/api/v1/admin/tenant-types', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

export async function updateTenantType(
	code: string,
	payload: { label?: string; active?: boolean; sort_order?: number }
): Promise<TenantType> {
	return api<TenantType>(`/api/v1/admin/tenant-types/${encodeURIComponent(code)}`, {
		method: 'PATCH',
		body: JSON.stringify(payload)
	});
}

export async function updateTenantTheme(
	id: string,
	payload: { theme_preset_id: string; theme_color_mode: string; theme_overrides?: { accent?: string } }
): Promise<Tenant> {
	return api<Tenant>(`/api/v1/admin/tenants/${id}/theme`, {
		method: 'PATCH',
		body: JSON.stringify(payload)
	});
}

export type { BrandTheme };

export function tenantPublicUrl(tenant: Pick<Tenant, 'slug' | 'public_host'>): string {
	let url = '';
	if (tenant.public_host) {
		url = tenant.public_host.startsWith('http')
			? tenant.public_host
			: `http://${tenant.public_host}`;
	} else {
		url = `http://${tenant.slug}.localhost:5173`;
	}
	if (typeof window !== 'undefined') {
		try {
			const u = new URL(url);
			if (window.location.port) u.port = window.location.port;
			return u.toString().replace(/\/$/, '') + '/';
		} catch {
			/* fall through */
		}
	}
	return url.endsWith('/') ? url : `${url}/`;
}
