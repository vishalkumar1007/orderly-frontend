import { env } from '$env/dynamic/public';
import { api } from '$lib/api/client';
import { isLocalBaseDomain, tenantStoreUrl } from '$lib/host';
import type { BrandTheme, ThemePreset } from '$lib/brandTheme';
import type {
	AuditLog,
	AwaitingSetup,
	CapabilityRow,
	CreateTenantPayload,
	CreatedTenant,
	DashboardData,
	ExpiringSubscription,
	Plan,
	PlanWritePayload,
	PlatformSettings,
	PlatformUser,
	PlanOption,
	Subscription,
	SystemHealth,
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
	expiring_subscriptions: ExpiringSubscription[];
	awaiting_setup: AwaitingSetup[];
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
		system_health: [],
		expiring_subscriptions: live.expiring_subscriptions ?? [],
		awaiting_setup: live.awaiting_setup ?? [],
		suspended: tenantActivityFromList(suspended)
	};
}

export async function fetchTenants(): Promise<Tenant[]> {
	const data = await api<{ tenants: Tenant[] }>('/api/v1/admin/tenants');
	return data.tenants;
}

export async function fetchTenant(id: string): Promise<Tenant> {
	return api<Tenant>(`/api/v1/admin/tenants/${id}`);
}

export type CreateUserPayload = {
	name: string;
	email: string;
	phone?: string;
	role: 'TENANT_ADMIN' | 'STAFF';
};

export type UpdateUserPayload = {
	name?: string;
	phone?: string;
	role?: 'TENANT_ADMIN' | 'STAFF';
	status?: 'ACTIVE' | 'DISABLED';
};

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

/**
 * Read-only: the business's own current MFA policy. Super Admin seeds the
 * initial one at onboarding; day-to-day edits belong to that business's own
 * Tenant Admin (PUT /api/v1/tenant/mfa-policy), not this console.
 */
export async function fetchTenantMfaPolicyAdmin(id: string): Promise<{
	allowed: boolean;
	mode: 'DISABLED' | 'OPTIONAL' | 'REQUIRED';
	allowed_methods: ('TOTP' | 'EMAIL_OTP')[];
	enforce_scope: 'ALL_ADMINS' | 'SELECTED_ROLES';
	enforce_roles: string[] | null;
	grace_period_days: number;
}> {
	return api(`/api/v1/admin/tenants/${id}/mfa-policy`);
}

/* ------------------------------------------------------------------ *
 * Plans, subscriptions and monitoring
 * ------------------------------------------------------------------ */

/** Every plan, including withdrawn ones, with how many businesses use them. */
export async function fetchPlans(): Promise<Plan[]> {
	const data = await api<{ plans: Plan[] }>('/api/v1/admin/plans');
	return data.plans.map(normalizePlan);
}

/**
 * Plans as the onboarding picker wants them.
 *
 * Withdrawn plans are dropped here rather than in the wizard: a plan that is
 * off is not an offer, and the one place that decides that should be the one
 * place that knows what "off" means.
 */
export async function fetchPlanOptions(businessType?: string): Promise<PlanOption[]> {
	const plans = await fetchPlans();
	return plans.filter((p) => p.is_active).filter((p) => offeredTo(p, businessType)).map(toPlanOption);
}

/** A plan with no business types listed is offered to every business type. */
export function offeredTo(plan: Plan, businessType?: string): boolean {
	if (!businessType || plan.business_types.length === 0) return true;
	return plan.business_types.includes(businessType.toUpperCase());
}

/** Fill in anything an older stored plan document does not carry. */
function normalizePlan(p: Plan): Plan {
	return {
		...p,
		price: Number(p.price) || 0,
		features: Array.isArray(p.features) ? p.features : [],
		business_types: Array.isArray(p.business_types) ? p.business_types : [],
		trial_days: Number(p.trial_days) || 0,
		billing_period: p.billing_period || 'monthly'
	};
}

/** One plan, in the shape the picker renders. */
export function toPlanOption(p: Plan): PlanOption {
	return {
		id: p.id,
		// The backend matches on the exact upper-case name — send `code`, never `name`.
		code: p.name.toUpperCase(),
		label: p.name.charAt(0) + p.name.slice(1).toLowerCase(),
		description: p.description ?? '',
		price: p.price,
		maxStaff: p.max_staff ?? null,
		maxProducts: p.max_products ?? null,
		billingPeriod: p.billing_period,
		trialDays: p.trial_days,
		features: p.features,
		businessTypes: p.business_types,
		isActive: p.is_active
	};
}

export async function createPlan(payload: PlanWritePayload): Promise<Plan> {
	return normalizePlan(
		await api<Plan>('/api/v1/admin/plans', { method: 'POST', body: JSON.stringify(payload) })
	);
}

export async function updatePlan(id: string, payload: PlanWritePayload): Promise<Plan> {
	return normalizePlan(
		await api<Plan>(`/api/v1/admin/plans/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
	);
}

/** Every subscription, one row per business. */
export async function fetchSubscriptions(): Promise<Subscription[]> {
	const data = await api<{ subscriptions: Subscription[] }>('/api/v1/admin/subscriptions');
	return data.subscriptions;
}

/**
 * Move a business onto another plan.
 *
 * This is the one commercial control the console holds over a live business:
 * what it is provisioned for. It never touches the shop itself.
 */
export async function changeTenantPlan(tenantId: string, plan: string): Promise<Tenant> {
	return api<Tenant>(`/api/v1/admin/tenants/${tenantId}/change-plan`, {
		method: 'POST',
		body: JSON.stringify({ plan })
	});
}

/** Live component status: API, database and every configured provider. */
export async function fetchSystemHealth(): Promise<SystemHealth> {
	return api<SystemHealth>('/api/v1/admin/system-health');
}

/* ------------------------------------------------------------------ *
 * Console access
 *
 * Who can reach this console. Business staff are not here and cannot be
 * created from here: they are invited inside their own business, by someone
 * who works there.
 * ------------------------------------------------------------------ */

export type ConsoleRole = 'SUPER_ADMIN' | 'PLATFORM_ADMIN' | 'SUPPORT';

export type ConsolePermission =
	| 'platform_businesses'
	| 'platform_plans'
	| 'platform_providers'
	| 'platform_iam'
	| 'platform_settings'
	| 'platform_monitoring';

export type ConsolePermissionInfo = {
	key: ConsolePermission;
	label: string;
	group: string;
	description: string;
};

export type ConsoleRoleInfo = {
	key: ConsoleRole | string;
	label: string;
	description: string;
	permissions: ConsolePermission[];
	assignable: boolean;
};

export type ConsoleUser = {
	id: string;
	name: string;
	email: string;
	phone: string;
	role: ConsoleRole | string;
	role_label: string;
	status: 'ACTIVE' | 'INVITED' | 'DISABLED' | string;
	must_set_password: boolean;
	permissions: ConsolePermission[];
	active_sessions: number;
	created_at: string;
	last_activity: string | null;
	/** True for the signed-in account, which cannot change its own access. */
	is_self: boolean;
	/** True for the one owner account, which cannot be demoted or disabled. */
	is_owner: boolean;
};

export type ConsoleAccess = {
	users: ConsoleUser[];
	roles: ConsoleRoleInfo[];
	permissions: ConsolePermissionInfo[];
	summary: { owners: number; admins: number; support: number; total: number };
};

/** The result of inviting someone, or reissuing their invitation. */
export type ConsoleInviteResult = {
	user: ConsoleUser;
	setup_url: string;
	email_sent: boolean;
	email_error: string;
};

export async function fetchConsoleAccess(): Promise<ConsoleAccess> {
	return api<ConsoleAccess>('/api/v1/admin/users');
}

export async function inviteConsoleUser(payload: {
	name: string;
	email: string;
	phone?: string;
	role: 'PLATFORM_ADMIN' | 'SUPPORT';
}): Promise<ConsoleInviteResult> {
	return api<ConsoleInviteResult>('/api/v1/admin/users', {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

export async function updateConsoleUser(
	id: string,
	payload: { name?: string; phone?: string; role?: 'PLATFORM_ADMIN' | 'SUPPORT'; status?: 'ACTIVE' | 'DISABLED' }
): Promise<ConsoleUser> {
	return api<ConsoleUser>(`/api/v1/admin/users/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(payload)
	});
}

export async function resendConsoleInvite(id: string): Promise<ConsoleInviteResult> {
	return api<ConsoleInviteResult>(`/api/v1/admin/users/${id}/resend-invite`, { method: 'POST' });
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
	/** `reset: true` puts the console theme back to a fresh install's, server-side. */
	branding?: Partial<PlatformSettings['branding']> & { reset?: boolean };
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

export async function checkEmailAvailable(email: string) {
	return api<{ available: boolean; email: string; reason?: string }>(
		`/api/v1/admin/tenants/email-available?email=${encodeURIComponent(email)}`
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

/**
 * A tenant's staff, as seen from the support side.
 *
 * This is the read/recover path, not a second place to run a tenant's team
 * from — see server.go's route comment. Resetting access or resending an
 * invite is unblocking someone locked out; it does not add a routine
 * "edit any field" surface here.
 */
export async function fetchTenantUsers(tenantId: string): Promise<TenantAdmin[]> {
	const data = await api<{ users: TenantAdmin[] }>(`/api/v1/admin/tenants/${tenantId}/users`);
	return data.users ?? [];
}

export async function resetTenantUserAccess(tenantId: string, userId: string): Promise<UserInviteResult> {
	return api<UserInviteResult>(`/api/v1/admin/tenants/${tenantId}/users/${userId}/reset-access`, {
		method: 'POST'
	});
}

/** Turns off a locked-out user's two-factor authentication. Never returns a secret or codes — there are none to return. */
export async function resetTenantUserMFA(tenantId: string, userId: string): Promise<void> {
	await api(`/api/v1/admin/tenants/${tenantId}/users/${userId}/reset-mfa`, { method: 'POST' });
}

export async function resendTenantUserInvite(tenantId: string, userId: string): Promise<UserInviteResult> {
	return api<UserInviteResult>(`/api/v1/admin/tenants/${tenantId}/users/${userId}/resend-invite`, {
		method: 'POST'
	});
}

export async function fetchThemePresets(): Promise<ThemePreset[]> {
	const data = await api<{ presets: ThemePreset[] }>('/api/v1/admin/theme-presets');
	return data.presets;
}

export async function fetchTenantTypes(): Promise<TenantType[]> {
	const data = await api<{ types: TenantType[] }>('/api/v1/admin/tenant-types');
	return data.types;
}

/**
 * The capability matrix row for one business type — what the wizard's
 * capability-driven configuration step (Barber, Hotel, General) renders as
 * fixed "included" badges plus toggles for the configurable ones.
 */
export async function fetchBusinessTypeCapabilities(code: string): Promise<CapabilityRow[]> {
	const data = await api<{ capabilities: CapabilityRow[] }>(
		`/api/v1/admin/business-types/${encodeURIComponent(code)}/capabilities`
	);
	return data.capabilities;
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

export type { BrandTheme };

export function tenantPublicUrl(tenant: Pick<Tenant, 'slug' | 'public_host'>): string {
	const baseDomain = env.PUBLIC_BASE_DOMAIN || 'localhost';
	let url = '';
	if (tenant.public_host) {
		if (tenant.public_host.startsWith('http://') || tenant.public_host.startsWith('https://')) {
			url = tenant.public_host;
		} else {
			const hostOnly = tenant.public_host.split('/')[0] ?? tenant.public_host;
			const local = hostOnly.includes('localhost') || hostOnly.startsWith('127.0.0.1');
			url = `${local ? 'http' : 'https'}://${tenant.public_host}`;
		}
	} else {
		const port = isLocalBaseDomain(baseDomain)
			? typeof window !== 'undefined'
				? window.location.port || '5173'
				: '5173'
			: null;
		url = tenantStoreUrl(tenant.slug, baseDomain, port);
	}
	if (typeof window !== 'undefined' && isLocalBaseDomain(baseDomain)) {
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

/**
 * Upload a platform-level branding asset (e.g., business logo during onboarding).
 */
export async function uploadAdminAsset(file: File): Promise<{ url: string; key: string }> {
	const formData = new FormData();
	formData.append('file', file);
	return api<{ url: string; key: string }>('/api/v1/admin/upload', {
		method: 'POST',
		body: formData
	});
}

