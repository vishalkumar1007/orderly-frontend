/** Configurable integrations. Mirrors the backend's configsvc package. */

export type ConfigService = 'SMTP' | 'STORAGE' | 'AI' | 'SMS';
export type ConfigSource = 'PLATFORM' | 'ORGANIZATION';
export type ConfigStatus =
	| 'UNCONFIGURED'
	| 'CONFIGURED'
	| 'ENABLED'
	| 'DISABLED'
	| 'CONNECTION_FAILED'
	| 'TESTING';

export type ProviderInfo = {
	value: string;
	label: string;
	base_url?: string;
	needs_endpoint?: boolean;
	default_region?: string;
	default_model?: string;
	default_embedding_model?: string;
};

/**
 * The only configuration shape the API returns. It deliberately has no password,
 * secret_key or api_key field — the backend redacts them and reports presence
 * through has_secret instead.
 */
export type ConfigView = {
	service: ConfigService;
	label: string;
	scope: ConfigSource;
	provider: string;
	config: Record<string, unknown>;
	has_secret: boolean;
	has_any_secret: boolean;
	status: ConfigStatus;
	enabled: boolean;
	allow_tenants: boolean;
	last_error?: string;
	last_tested_at?: string;
	secret_fields: string[];
	providers: ProviderInfo[];
	updated_at: string;
};

/** What a tenant sees about which level it may use. */
export type TenantConfigOptions = {
	service: ConfigService;
	source: ConfigSource;
	source_set: boolean;
	platform_available: boolean;
	platform_reason?: string;
	organization_configured: boolean;
	organization_status: ConfigStatus;
	platform_configured: boolean;
	platform_status: ConfigStatus;
};

/** Everything a tenant's configuration page renders. */
export type TenantServiceView = {
	options: TenantConfigOptions;
	own_config: ConfigView;
};

/** One service as seen by a tenant, with the effective-configuration probe. */
export type TenantServiceDetail = {
	service: ConfigService;
	options: TenantConfigOptions;
	own_config: ConfigView;
	in_use: boolean;
	source: ConfigSource;
	unavailable_reason?: string;
	hint?: string;
};

export type EffectiveConfig = {
	service: ConfigService;
	available: boolean;
	source?: ConfigSource;
	provider?: string;
	status?: ConfigStatus;
	reason?: string;
	hint?: string;
};

export type TestOutcome = {
	ok: boolean;
	message: string;
	detail?: string;
};

/** Platform listing, which also reports whether encryption is configured. */
export type PlatformConfigList = {
	configurations: ConfigView[];
	encryption: { enabled: boolean };
};

/** One tenant's posture as seen by a Super Admin. No configuration values. */
export type AdminTenantService = {
	service: ConfigService;
	source: ConfigSource;
	source_set: boolean;
	allow_platform: boolean;
	platform_available: boolean;
	organization_configured: boolean;
	organization_status: ConfigStatus;
	platform_configured: boolean;
	platform_status: ConfigStatus;
};

export type AdminTenantConfigOverview = {
	tenant_id: string;
	services: AdminTenantService[];
	/** Present when a revocation leaves the tenant pointing at the platform. */
	warning?: string;
};

/** One row of the cross-tenant posture table. */
export type TenantConfigPosture = {
	tenant_id: string;
	tenant_name: string;
	tenant_slug: string;
	service: ConfigService;
	allow_platform: boolean;
	source: ConfigSource | '';
	own_status: ConfigStatus;
	own_enabled: boolean;
	platform_status: ConfigStatus;
	platform_enabled: boolean;
	platform_allow_tenants: boolean;
};

export type PostureResponse = {
	tenants: TenantConfigPosture[];
	services: ConfigService[];
};

export type SaveConfigPayload = {
	provider?: string;
	config: Record<string, unknown>;
	enabled?: boolean;
};

/** The sentinel the backend understands as "leave this secret unchanged". */
export const MASK_SENTINEL = '__KEEP__';

export const CONFIG_SERVICE_LABEL: Record<ConfigService, string> = {
	SMTP: 'Email / SMTP',
	STORAGE: 'Storage',
	AI: 'AI',
	SMS: 'SMS'
};

export const CONFIG_STATUS_LABEL: Record<ConfigStatus, string> = {
	UNCONFIGURED: 'Not configured',
	CONFIGURED: 'Configured',
	ENABLED: 'Enabled',
	DISABLED: 'Disabled',
	CONNECTION_FAILED: 'Connection failed',
	TESTING: 'Testing'
};

/** Tone for the shared StatusBadge, keyed by configuration status. */
export const CONFIG_STATUS_TONE: Record<
	ConfigStatus,
	'ok' | 'warn' | 'danger' | 'neutral' | 'accent'
> = {
	UNCONFIGURED: 'neutral',
	CONFIGURED: 'accent',
	ENABLED: 'ok',
	DISABLED: 'neutral',
	CONNECTION_FAILED: 'danger',
	TESTING: 'warn'
};

/** Human labels for the fields of each service, used to build forms. */
export const CONFIG_FIELDS: Record<
	ConfigService,
	{ key: string; label: string; type?: string; hint?: string; secret?: boolean }[]
> = {
	SMTP: [
		{ key: 'host', label: 'Host', hint: 'smtp.example.com' },
		{ key: 'port', label: 'Port', type: 'number' },
		{
			key: 'encryption',
			label: 'Encryption',
			type: 'select',
			hint: 'STARTTLS is the usual choice on port 587'
		},
		{ key: 'username', label: 'Username' },
		{ key: 'password', label: 'Password', type: 'password', secret: true },
		{ key: 'from_name', label: 'From name' },
		{ key: 'from_email', label: 'From email', type: 'email' },
		{ key: 'reply_to', label: 'Reply-to', type: 'email', hint: 'Optional' }
	],
	STORAGE: [
		{
			key: 'endpoint',
			label: 'Endpoint',
			hint: 'Required for R2 and MinIO; leave blank for Amazon S3'
		},
		{ key: 'region', label: 'Region' },
		{ key: 'bucket', label: 'Bucket' },
		{ key: 'access_key', label: 'Access key' },
		{ key: 'secret_key', label: 'Secret key', type: 'password', secret: true },
		{ key: 'public_url', label: 'Public / CDN URL', hint: 'Optional; leave blank for a private bucket' },
		{ key: 'path_prefix', label: 'Path prefix', hint: 'Optional; isolates this tenant inside the bucket' }
	],
	AI: [
		{ key: 'base_url', label: 'Base URL', hint: 'Defaults to the provider’s endpoint' },
		{ key: 'default_model', label: 'Default model' },
		{ key: 'embedding_model', label: 'Embedding model', hint: 'Optional' },
		{ key: 'organization_id', label: 'Organization ID', hint: 'Optional' },
		{ key: 'api_key', label: 'API key', type: 'password', secret: true },
		{ key: 'request_timeout_seconds', label: 'Request timeout (s)', type: 'number' },
		{ key: 'max_output_tokens', label: 'Max output tokens', type: 'number' },
		{ key: 'rate_limit_per_minute', label: 'Rate limit (req/min)', type: 'number' }
	],
	SMS: [
		{ key: 'account_sid', label: 'Account SID' },
		{ key: 'auth_token', label: 'Auth token', type: 'password', secret: true },
		{ key: 'from_number', label: 'From number', hint: 'E.164 format, e.g. +14155551234' }
	]
};

export const ENCRYPTION_OPTIONS = [
	{ value: 'STARTTLS', label: 'STARTTLS' },
	{ value: 'TLS', label: 'TLS (implicit)' },
	{ value: 'NONE', label: 'None' }
];
