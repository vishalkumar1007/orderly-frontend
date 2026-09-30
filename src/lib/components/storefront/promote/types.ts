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

/** Top-level tabs on Publish & Marketing. */
export type PromoteTab = 'publish' | 'marketing' | 'compliance';

export const PROMOTE_TABS: PromoteTab[] = ['publish', 'marketing', 'compliance'];

export type MarketingAsset = 'qr' | 'card' | 'thumbnail' | 'banner';

export const MARKETING_ASSETS: MarketingAsset[] = ['qr', 'card', 'thumbnail', 'banner'];

const LEGACY_TAB_MAP: Record<string, PromoteTab> = {
	readiness: 'publish',
	publish: 'publish',
	marketing: 'marketing',
	compliance: 'compliance'
};

/** Resolve tab from ?tab= (legacy readiness → publish). */
export function resolvePromoteTab(
	searchParams: URLSearchParams,
	opts?: { published?: boolean }
): PromoteTab {
	const raw = searchParams.get('tab') ?? '';
	const mapped = LEGACY_TAB_MAP[raw];
	if (mapped) return mapped;
	if (opts?.published) return 'marketing';
	return 'publish';
}

/** Resolve marketing asset from ?asset= (default qr). */
export function resolveMarketingAsset(searchParams: URLSearchParams): MarketingAsset {
	const raw = searchParams.get('asset') ?? '';
	if ((MARKETING_ASSETS as readonly string[]).includes(raw)) {
		return raw as MarketingAsset;
	}
	return 'qr';
}
