export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'CREATED' | 'SETUP' | 'READY';
export type SetupStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
export type PlanCode = 'TRIAL' | 'STARTER' | 'BUSINESS';
/**
 * A business-type code. The set is open on purpose — an operator can add one
 * under Settings — so this is a string with the built-in shapes documented
 * rather than a closed union. `lib/admin/businessTypes.ts` owns what each code
 * means.
 */
export type BusinessType =
	| 'FOOD_SHOP'
	| 'GROCERY'
	| 'CAFE'
	| 'RESTAURANT'
	| 'HOTEL'
	| 'OTHER'
	| (string & {});
/**
 * Roles the platform knows. MANAGER sits between owner and staff: it runs the
 * shop day to day without being able to reconfigure it. `pkg/identity` decides
 * what each one may reach, and the API sends that list with the identity.
 */
export type UserRole = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'MANAGER' | 'STAFF';
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
	/**
	 * The business-type template, applied to the new tenant's storefront in the
	 * same transaction that creates it. Shapes mirror the storefront API, so
	 * the wizard sends what it built rather than a translated copy.
	 */
	configuration?: TenantConfigurationPayload;
	/** Required: the Super Admin confirms the platform's terms on the business's behalf. */
	terms_accepted: boolean;
	/**
	 * Per-capability on/off choices for capability-driven business types
	 * (Barber, Hotel, General). Only applied server-side where
	 * business_type_capabilities marks the capability configurable for the
	 * chosen type — everything else in this map is ignored, never a way to
	 * force on a module the business type structurally does not have.
	 */
	capability_overrides?: Record<string, boolean>;
};

/** One row of business_type_capabilities, as the onboarding wizard reads it. */
export type CapabilityRow = {
	code: string;
	label: string;
	default_enabled: boolean;
	configurable: boolean;
};

export type TenantConfigurationPayload = {
	theme_preset?: string;
	theme_mode?: string;
	primary_color?: string;
	secondary_color?: string;
	accent_color?: string;
	product_layout?: string;
	filter_style?: string;
	hero_style?: string;
	font_family?: string;
	radius?: string;
	card_style?: string;
	button_style?: string;
	ordering_enabled?: boolean;
	customer_login_mode?: string;
	prep_time_minutes?: number;
	payments?: {
		online_payment_enabled: boolean;
		cash_enabled: boolean;
		pay_at_pickup_enabled: boolean;
		default_payment_method: string;
	};
	workflow?: {
		acceptance_mode: string;
		payment_requirement: string;
		ready_notification: boolean;
		auto_complete: boolean;
	};
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
	/** Everything the "Needs attention" panel is built from. */
	expiring_subscriptions: ExpiringSubscription[];
	awaiting_setup: AwaitingSetup[];
	suspended: TenantActivityItem[];
};

export type PlatformUser = {
	id: string;
	name: string;
	email: string;
	phone?: string;
	tenant_id: string | null;
	tenant_name: string | null;
	tenant_slug?: string;
	tenant_status?: string;
	role: UserRole | string;
	status: UserStatus | string;
	/**
	 * PLATFORM for the console owner, TENANT for everyone else. The two are
	 * never mixed: a platform role grants nothing inside a business, and a
	 * business role grants nothing on the platform.
	 */
	scope?: 'PLATFORM' | 'TENANT';
	last_activity: string | null;
	created_at: string;
};

export type BillingPeriod = 'trial' | 'monthly' | 'yearly' | 'one_time';

/** A plan exactly as `GET /admin/plans` returns it. */
export type Plan = {
	id: string;
	name: string;
	description: string;
	price: number;
	max_staff: number;
	max_products: number;
	is_active: boolean;
	billing_period: BillingPeriod | string;
	trial_days: number;
	/** What the plan includes, in the operator's own words. */
	features: string[];
	/** Business types the plan is offered to. Empty means all of them. */
	business_types: string[];
	/** Present on the list endpoint only. */
	tenant_count?: number;
	active_subscriptions?: number;
};

export type PlanWritePayload = {
	name?: string;
	description?: string;
	price?: number;
	max_staff?: number;
	max_products?: number;
	is_active?: boolean;
	billing_period?: string;
	trial_days?: number;
	features?: string[];
	business_types?: string[];
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
	billingPeriod: BillingPeriod | string;
	trialDays: number;
	features: string[];
	/** Empty means the plan is offered to every business type. */
	businessTypes: string[];
	isActive: boolean;
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
	price?: number;
};

/* ------------------------------------------------------------------ *
 * Monitoring
 * ------------------------------------------------------------------ */

export type ComponentHealth = 'HEALTHY' | 'WARNING' | 'ERROR' | 'UNAVAILABLE';

export type HealthComponent = {
	id: string;
	name: string;
	group: string;
	status: ComponentHealth | string;
	detail: string;
	latency_ms?: number;
	/** True when a Super Admin can act on the component from the console. */
	managed?: boolean;
	href?: string;
};

export type SystemHealth = {
	status: ComponentHealth | string;
	checked_at: string;
	components: HealthComponent[];
};

/** A subscription approaching its trial or term end. */
export type ExpiringSubscription = {
	subscription_id: string;
	tenant_id: string;
	tenant_name: string;
	tenant_slug: string;
	plan: string;
	status: string;
	ends_at: string;
};

/** A business whose administrator has never signed in. */
export type AwaitingSetup = {
	tenant_id: string;
	tenant_name: string;
	tenant_slug: string;
	status: string;
	created_at: string;
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
		default_currency: string;
	};
	/** The console's own theme, never a tenant's. */
	branding: {
		primary_color: string;
		secondary_color: string;
		/** The console theme everyone starts from, before their own choice. */
		preset_id: string;
		color_mode: 'light' | 'dark' | 'system';
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

/**
 * The built-in shapes. The live catalogue comes from `GET /admin/tenant-types`
 * — this is only the fallback used before it loads.
 */
export const BUSINESS_TYPES: BusinessType[] = [
	'FOOD_SHOP',
	'GROCERY',
	'CAFE',
	'RESTAURANT',
	'HOTEL',
	'OTHER'
];

export const PLAN_CODES: PlanCode[] = ['TRIAL', 'STARTER', 'BUSINESS'];
