import type { DashboardSetup, SetupStepKey } from '$lib/tenant/dashboardCache.svelte';

export type Setup = DashboardSetup;
export type SetupStepKeyAlias = SetupStepKey;

export type StoreLink = {
	name: string;
	public_host: string;
	public_path: string;
	is_published: boolean;
};

export type TabKey = 'readiness' | 'hours' | 'operations' | 'broadcast' | 'compliance';

export const TAB_KEYS: TabKey[] = ['readiness', 'hours', 'operations', 'broadcast', 'compliance'];

/** Resolve tab from ?tab= or #hash (dashboard deep links use #hours). */
export function resolveLaunchTab(searchParams: URLSearchParams, hash: string): TabKey {
	const fromQuery = searchParams.get('tab') as TabKey | null;
	if (fromQuery && TAB_KEYS.includes(fromQuery)) return fromQuery;
	const fromHash = hash.replace(/^#/, '') as TabKey;
	if (fromHash && TAB_KEYS.includes(fromHash)) return fromHash;
	return 'readiness';
}
