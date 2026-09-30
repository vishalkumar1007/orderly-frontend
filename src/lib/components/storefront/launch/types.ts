import type { DashboardSetup, SetupStepKey } from '$lib/tenant/dashboardCache.svelte';

export type Setup = DashboardSetup;
export type SetupStepKeyAlias = SetupStepKey;

export type StoreLink = {
	name: string;
	slug?: string;
	public_host: string;
	public_path: string;
	/** Absolute storefront URL — prefer this over assembling host+path. */
	public_url?: string;
	is_published: boolean;
	ordering_open?: boolean;
	store_status?: string;
	store_status_label?: string;
	status_message?: string;
};

export type TabKey = 'readiness' | 'compliance';

export const TAB_KEYS: TabKey[] = ['readiness', 'compliance'];

/** Resolve tab from ?tab= or #hash (dashboard deep links use #hours → Action redirect). */
export function resolveLaunchTab(searchParams: URLSearchParams, hash: string): TabKey {
	const fromQuery = searchParams.get('tab') as TabKey | null;
	if (fromQuery && TAB_KEYS.includes(fromQuery)) return fromQuery;
	const fromHash = hash.replace(/^#/, '') as TabKey;
	if (fromHash && TAB_KEYS.includes(fromHash)) return fromHash;
	return 'readiness';
}
