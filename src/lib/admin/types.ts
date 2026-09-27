export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'CREATED' | 'SETUP' | 'READY';
export type SetupStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
export type PlanCode = 'TRIAL' | 'STARTER' | 'BUSINESS';
export type BusinessType = 'MOMO' | 'MANCHURIAN' | 'FAST_FOOD' | 'ROLLS' | 'TEA' | 'OTHER';
export type UserRole = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'STAFF';
export type UserStatus = 'ACTIVE' | 'DISABLED' | 'INVITED';
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
export type AuditResult = 'SUCCESS' | 'FAILURE' | 'DENIED';
export type HealthStatus = 'operational' | 'degraded' | 'down';

export type Tenant = {
	id: string;
	name: string;
	slug: string;
	business_type: BusinessType | string;
	status: TenantStatus | string;
	is_published: boolean;
	setup_status?: SetupStatus | string;
	owner_name: string;
	phone: string;
	email: string;
	address: string;
	public_host?: string;
	plan?: PlanCode | string;
	created_at?: string;
	updated_at?: string;
	last_active_at?: string;
	theme_preset_id?: string;
	theme_color_mode?: 'light' | 'dark' | 'system' | string;
	theme?: import('$lib/brandTheme').BrandTheme;
	/** Present on GET /admin/tenants/:id when a subscription row exists. */
	subscription?: Record<string, unknown> | null;
	plan_price?: number;
	logo_url?: string;
	favicon_url?: string;
	short_description?: string;
	currency?: string;
	timezone?: string;
	language?: string;
	store_status?: 'OPEN' | 'BUSY' | 'AWAY' | 'CLOSED' | string;
	status_message?: string;
	shop_type?: string;
};

export type TenantAdmin = {
	id: string;
	name: string;
	email: string;
	phone?: string;
	status: string;
	must_set_password?: boolean;
	role?: UserRole;
	last_activity?: string | null;
	created_at?: string;
	tenant_id?: string;
};

/** Response from the user lifecycle endpoints. */
export type UserInviteResult = {
	user: TenantAdmin;
	setup_url: string;
	email_sent: boolean;
	email_error: string;
};

export type CreateTenantPayload = {
	name: string;
	slug: string;
	business_type: string;
	owner_name: string;
	phone: string;
	email: string;
	address: string;
	plan?: string;
	theme_preset_id?: string;
	theme_color_mode?: string;
	theme_overrides?: { accent?: string; accent2?: string };
	admin_name: string;
	admin_email: string;
	admin_phone?: string;
	logo_url?: string;
	favicon_url?: string;
	short_description?: string;
	currency?: string;
	timezone?: string;
	language?: string;
	store_status?: 'OPEN' | 'BUSY' | 'AWAY' | 'CLOSED';
	status_message?: string;
	store_name?: string;
};

export type CreatedTenant = {
	tenant: { id: string; slug: string; name: string; status?: string };
	admin_email: string;
	invite_token: string;
	setup_path: string;
	tenant_url: string;
	login_url: string;
	plan?: string;
	email_sent?: boolean;
	email_error?: string;
	theme?: import('$lib/brandTheme').BrandTheme;
};

export type DashboardLiveStats = {
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
};

export type ChartPoint = {
	day?: string;
	week_start?: string;
	order_count?: number;
	tenant_count?: number;
	revenue?: string;
};

export type TenantStatusBreakdown = { status: string; count: number };

export type TenantSecurity = {
	users_total: number;
	users_active: number;
	users_pending_password: number;
	active_sessions: number;
	audit_events: number;
	audit_events_7d: number;
};

export type TenantMetrics = {
	orders: number;
	revenue: string;
	active_users: number;
	current_plan: string;
	orders_today: number;
	revenue_today: string;
	cancelled_orders: number;
	avg_order_value: string;
	first_order_at: string;
	last_order_at: string;
	status_breakdown: TenantStatusBreakdown[];
	security: TenantSecurity;
	subscription_status?: string;
	subscription?: Record<string, unknown> | null;
	orders_by_day: { day: string; order_count: number; revenue?: string }[];
	recent_activity?: PlatformEvent[];
};

export type DashboardOverview = {
	total_tenants: number;
	active_tenants: number;
	pending_setup: number;
	suspended_tenants: number;
	/** plan.md §4.1 / tenet_plan.md §26 — tenants still on a trial plan. */
	trial_tenants: number;
};

export type TenantType = {
	code: string;
	label: string;
	active: boolean;
	sort_order: number;
};

export type BusinessMetrics = {
	total_orders: number;
	orders_today: number;
	revenue: string;
	/** plan.md §4.1 — "Total order value today". */
	order_value_today: string;
	active_users: number;
};

export type TenantActivityItem = {
	id: string;
	name: string;
	slug: string;
	status: string;
	plan?: string;
	at: string;
};

export type PlatformEvent = {
	id: string;
	timestamp: string;
	actor: string;
	actor_email?: string;
	action: string;
	resource: string;
	tenant?: string | null;
	result: AuditResult | string;
};

export type SystemHealthItem = {
	id: string;
	name: string;
	status: HealthStatus;
	detail: string;
	checked_at: string;
};

export type DashboardData = {
	overview: DashboardOverview;
	business: BusinessMetrics;
	recently_created: TenantActivityItem[];
	recently_active: TenantActivityItem[];
	recently_suspended: TenantActivityItem[];
	platform_events: PlatformEvent[];
	system_health: SystemHealthItem[];
	orders_by_day?: ChartPoint[];
	tenants_by_week?: ChartPoint[];
};

export type PlatformUser = {
	id: string;
	name: string;
	email: string;
	tenant_id: string | null;
	tenant_name: string | null;
	role: UserRole | string;
	status: UserStatus | string;
	last_activity: string | null;
	created_at: string;
};

export type Plan = {
	id: string;
	code: PlanCode | string;
	name: string;
	price: number;
	currency: string;
	billing_period: 'trial' | 'monthly' | 'yearly' | string;
	duration_label: string;
	features: string[];
	status: 'ACTIVE' | 'INACTIVE' | string;
	max_staff?: number;
	max_products?: number;
};

/** A plan as offered during tenant onboarding (mirrors GET /admin/plans). */
export type PlanOption = {
	id: string;
	/** Upper-case code the backend matches on, e.g. "TRIAL". */
	code: string;
	/** Display label, e.g. "Trial". */
	label: string;
	description: string;
	price: number;
	maxStaff: number | null;
	maxProducts: number | null;
};

export type Subscription = {
	id: string;
	tenant_id: string;
	tenant_name: string;
	plan_code: PlanCode | string;
	plan_name: string;
	status: SubscriptionStatus | string;
	trial_end: string | null;
	start_date: string;
	renewal_date: string | null;
};

export type AuditLog = {
	id: string;
	timestamp: string;
	actor: string;
	actor_email?: string;
	action: string;
	resource: string;
	resource_id?: string;
	tenant: string | null;
	result: AuditResult | string;
	metadata?: Record<string, unknown>;
};

export type TenantDetailExtras = {
	orders: number;
	revenue: string;
	active_users: number;
	current_plan: PlanCode | string;
	subscription_status: SubscriptionStatus | string;
	subscription?: Subscription | null;
	recent_activity: PlatformEvent[];
};

export type PlatformSettings = {
	general: {
		platform_name: string;
		support_email: string;
		timezone: string;
		default_locale: string;
	};
	security: {
		session_timeout_minutes: number;
		require_mfa_for_admins: boolean;
		password_min_length: number;
		invite_expiry_hours: number;
	};
	admin_profile?: {
		name: string;
		email: string;
		phone: string;
	};
	platform: {
		base_domain: string;
		frontend_port?: string;
		admin_host?: string;
		allow_self_serve: boolean;
		default_plan: string;
		maintenance_mode: boolean;
		read_only_settings?: boolean;
	};
	app_env?: string;
};

export const BUSINESS_TYPES: BusinessType[] = [
	'MOMO',
	'MANCHURIAN',
	'FAST_FOOD',
	'ROLLS',
	'TEA',
	'OTHER'
];

export const PLAN_CODES: PlanCode[] = ['TRIAL', 'STARTER', 'BUSINESS'];
