import { api } from '$lib/api/client';

/** Whether payments are dummy (nobody is charged) or real. */
export type PaymentMode = 'SANDBOX' | 'LIVE';

export type ReadinessCheck = { key: string; label: string; ok: boolean; detail?: string };

/** The go-live checklist for the gateway a business would actually use. */
export type Readiness = {
	ready: boolean;
	checks: ReadinessCheck[];
	credentials_source?: 'PLATFORM' | 'ORGANIZATION';
	provider?: string;
	/** Which gateway environment the keys belong to. */
	key_kind?: 'test' | 'live' | '';
};

export type ModeSetting = { mode: PaymentMode; updated_at?: string; updated_by?: string };

export type PlatformPayments = {
	v2_enabled: boolean;
	live_available: boolean;
	mode: PaymentMode;
	setting: ModeSetting | null;
	readiness: Readiness;
};

export type TenantPayments = {
	tenant_id: string;
	v2_enabled: boolean;
	live_available: boolean;
	override: ModeSetting | null;
	effective_mode: PaymentMode;
	mode_source: 'business' | 'platform' | 'default';
	readiness: Readiness;
};

/** What a business sees of its own mode. Read-only: only Super Admin changes it. */
export type OwnPaymentMode = {
	mode: PaymentMode;
	mode_source: 'business' | 'platform' | 'default';
	is_test: boolean;
	online_ready: boolean;
	v2_enabled: boolean;
};

export const fetchPlatformPayments = () => api<PlatformPayments>('/api/v1/admin/payments/settings');

export const setPlatformPaymentMode = (mode: PaymentMode, confirm = false) =>
	api<PlatformPayments>('/api/v1/admin/payments/settings', {
		method: 'PUT',
		body: JSON.stringify({ mode, confirm })
	});

export const fetchTenantPayments = (tenantId: string) =>
	api<TenantPayments>(`/api/v1/admin/tenants/${tenantId}/payments`);

export const setTenantPaymentMode = (
	tenantId: string,
	mode: PaymentMode | 'INHERIT',
	confirm = false
) =>
	api<TenantPayments>(`/api/v1/admin/tenants/${tenantId}/payments`, {
		method: 'PUT',
		body: JSON.stringify({ mode, confirm })
	});

export const fetchOwnPaymentMode = () => api<OwnPaymentMode>('/api/v1/tenant/payments/mode');

export const MODE_LABEL: Record<PaymentMode, string> = {
	SANDBOX: 'Dummy payments',
	LIVE: 'Real payments'
};

/** What needs a human, platform-wide. */
export type PaymentHealth = {
	overdue_pending: number;
	stuck_refunding: number;
	stuck_refunds: number;
	failed_events_24h: number;
	mismatches_24h: number;
	duplicates_24h: number;
	live_paid_24h: number;
	live_paid_amount_24h: string;
	needs_attention: boolean;
};

export const fetchPaymentHealth = () => api<PaymentHealth>('/api/v1/admin/payments/health');
