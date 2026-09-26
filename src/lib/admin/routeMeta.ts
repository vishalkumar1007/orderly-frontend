export type RouteMeta = { section: string; title: string };

type TenantHit = { id: string; name: string; slug: string; owner_name?: string };

const ROUTE_META: Record<string, RouteMeta> = {
	'/superadmin': { section: 'Overview', title: 'Dashboard' },
	'/superadmin/tenants': { section: 'Tenants', title: 'All tenants' },
	'/superadmin/tenants/new': { section: 'Tenants', title: 'Create tenant' },
	'/superadmin/users': { section: 'Platform', title: 'Users' },
	'/superadmin/activity': { section: 'Platform', title: 'Activity' },
	'/superadmin/settings': { section: 'System', title: 'Settings' }
};

const FALLBACK: RouteMeta = { section: 'Overview', title: 'Super Admin' };

/**
 * Resolve the page title from the pathname. Tenant detail pages resolve from the
 * already-loaded tenant list so the topbar shows the real business name.
 */
export function metaForPath(pathname: string, tenants: TenantHit[] = []): RouteMeta {
	const exact = ROUTE_META[pathname];
	if (exact) return exact;

	const match = /^\/superadmin\/tenants\/([^/]+)$/.exec(pathname);
	if (match) {
		const hit = tenants.find((t) => t.id === match[1]);
		return { section: 'Tenants', title: hit?.name ?? 'Tenant' };
	}

	return FALLBACK;
}

/** True for any tenant-scoped route, where onboarding actions belong. */
export function isTenantSection(pathname: string): boolean {
	return pathname === '/superadmin/tenants' || pathname.startsWith('/superadmin/tenants/');
}

/** Hide the primary action while already on the create form. */
export function isTenantCreatePage(pathname: string): boolean {
	return pathname === '/superadmin/tenants/new';
}

export type Crumb = { label: string; href: string | null };

/** Human labels for the static path segments under /superadmin. */
const SEGMENT_LABELS: Record<string, string> = {
	superadmin: 'Super Admin',
	tenants: 'Tenants',
	users: 'Users',
	activity: 'Activity',
	settings: 'Settings',
	new: 'New'
};

/** Tab ids that should surface as the trailing crumb on tenant detail. */
const TAB_LABELS: Record<string, string> = {
	overview: 'Overview',
	performance: 'Performance',
	users: 'Users',
	security: 'Security',
	brand: 'Brand',
	configuration: 'Configuration',
	details: 'Details',
	activity: 'Activity'
};

/**
 * Build a navigable trail, e.g. Super Admin / Tenants / Momo Magic / Performance.
 * Every crumb except the last links somewhere you can go back to.
 */
export function breadcrumbsFor(
	pathname: string,
	search: string,
	tenants: TenantHit[] = []
): Crumb[] {
	const segments = pathname.split('/').filter(Boolean);
	const crumbs: Crumb[] = [];

	segments.forEach((seg, i) => {
		const href = '/' + segments.slice(0, i + 1).join('/');
		let label = SEGMENT_LABELS[seg];

		// A UUID segment is a tenant id — show the business name instead.
		if (!label) {
			const hit = tenants.find((t) => t.id === seg);
			if (hit) label = hit.name;
		}

		crumbs.push({ label: label ?? seg, href });
	});

	// The active tab is part of "where am I", so surface it as the leaf.
	const tab = new URLSearchParams(search).get('tab');
	if (tab && TAB_LABELS[tab] && crumbs.length > 0) {
		crumbs.push({ label: TAB_LABELS[tab], href: null });
	}

	// The final crumb is the current page, not a link.
	if (crumbs.length > 0) {
		crumbs[crumbs.length - 1] = { ...crumbs[crumbs.length - 1], href: null };
	}

	return crumbs;
}
