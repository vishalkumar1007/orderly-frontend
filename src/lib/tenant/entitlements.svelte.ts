import { api, type ApiClientError } from '$lib/api/client';

/** GET /api/v1/tenant/entitlements */
export type Entitlements = {
	plan: string;
	features: { code: string; label: string; enabled: boolean; required_plan?: string }[];
	limits: Record<'staff' | 'products', { used: number; limit: number; over: boolean }>;
	license: { state: 'ACTIVE' | 'GRACE'; expires_at?: string; grace_ends_at?: string };
};

/** What the upgrade prompt shows: a refusal from the API, in plain words. */
export type PlanNotice = {
	title: string;
	message: string;
	/** The cheapest plan that would allow it, when the API names one. */
	requiredPlan?: string;
	usage?: string;
};

export const entitlementState = $state<{ data: Entitlements | null }>({ data: null });
export const planNotice = $state<{ current: PlanNotice | null }>({ current: null });

export async function loadEntitlements(): Promise<void> {
	try {
		entitlementState.data = await api<Entitlements>('/api/v1/tenant/entitlements');
	} catch {
		// Not fatal: the banner and prompts are advisory, the API still enforces.
		entitlementState.data = null;
	}
}

/**
 * Whether the plan includes a feature, for locking UI up front instead of
 * letting the owner hit a 403. Unknown (entitlements not loaded) reads as
 * allowed — the API still enforces, so this only avoids a false lock.
 */
export function featureAccess(code: string): { enabled: boolean; requiredPlan?: string } {
	const f = entitlementState.data?.features.find((x) => x.code === code);
	return f ? { enabled: f.enabled, requiredPlan: f.required_plan } : { enabled: true };
}

/** "1 product", "5 products", "1 staff member", "3 staff members" (the count is shown separately). */
function unit(resource: unknown, n: number): string {
	const [one, many] = resource === 'staff' ? ['staff member', 'staff members'] : ['product', 'products'];
	return n === 1 ? one : many;
}

/** Turn a plan/license refusal into the prompt the owner sees. */
export function showPlanNotice(err: ApiClientError): void {
	const d = err.details;
	const requiredPlan = typeof d.required_plan === 'string' ? d.required_plan : undefined;
	if (err.code === 'plan_limit') {
		planNotice.current = {
			title: 'Plan limit reached',
			message: err.message,
			requiredPlan,
			usage: `${d.used} of ${d.limit} ${unit(d.resource, Number(d.limit))} used`
		};
		// Usage changed under us; refresh the banner data too.
		void loadEntitlements();
	} else if (err.code === 'feature_not_in_plan') {
		planNotice.current = { title: 'Not included in your plan', message: err.message, requiredPlan };
	}
	// license_inactive is handled by the shell (full-page notice), not a dialog.
}

export function dismissPlanNotice(): void {
	planNotice.current = null;
}

export function resetEntitlements(): void {
	entitlementState.data = null;
	planNotice.current = null;
}
