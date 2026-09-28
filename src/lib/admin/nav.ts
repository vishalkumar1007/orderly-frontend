/**
 * Super Admin navigation, titles and breadcrumbs.
 *
 * These are pure functions over a pathname, kept out of the layout component
 * for the same reason the tenant console keeps its own (`lib/tenant/nav.ts`):
 * the console authenticates in the browser, so a server render can never tell a
 * correct title from a wrong one, and `scripts/check_nav.mjs` can exercise the
 * real module instead of a copy that agrees with itself forever.
 */

import type { Component } from 'svelte';
import Activity from '@lucide/svelte/icons/activity';
import Bell from '@lucide/svelte/icons/bell';
import Building2 from '@lucide/svelte/icons/building-2';
import CreditCard from '@lucide/svelte/icons/credit-card';
import HeartPulse from '@lucide/svelte/icons/heart-pulse';
import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
import Plug from '@lucide/svelte/icons/plug';
import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
import UserPlus from '@lucide/svelte/icons/user-plus';
import Users from '@lucide/svelte/icons/users';

export type AdminNavItem = {
	href: string;
	label: string;
	icon: Component;
	/** Match only this exact path, not its children. */
	exact?: boolean;
	/** Child paths that belong to a sibling entry. */
	exclude?: string[];
};

export type AdminNavGroup = {
	label: string;
	items: AdminNavItem[];
};

/**
 * The rail.
 *
 * Five groups, thirteen destinations, in the order the work actually happens:
 * you watch the platform, you onboard and run businesses, you configure the
 * platform they share, you check what changed, and only then do you touch
 * settings. Provider credentials deliberately do NOT live under Settings —
 * they are an operational surface with their own status and tests.
 */
export const SUPERADMIN_NAV: AdminNavGroup[] = [
	{
		label: 'Overview',
		// Exact: the dashboard must not stay lit while browsing a business.
		items: [{ href: '/superadmin', label: 'Dashboard', icon: LayoutDashboard, exact: true }]
	},
	{
		label: 'Businesses',
		items: [
			{
				href: '/superadmin/businesses',
				label: 'All businesses',
				icon: Building2,
				// Onboarding is its own destination, not a child of the list.
				exclude: ['/superadmin/businesses/new']
			},
			{ href: '/superadmin/businesses/new', label: 'Onboarding', icon: UserPlus },
			{ href: '/superadmin/plans', label: 'Plans & subscriptions', icon: CreditCard }
		]
	},
	{
		label: 'Platform',
		items: [
			{ href: '/superadmin/iam', label: 'Users & IAM', icon: Users },
			{ href: '/superadmin/providers', label: 'Providers & integrations', icon: Plug },
			{ href: '/superadmin/notifications', label: 'Notifications', icon: Bell }
		]
	},
	{
		label: 'Monitoring',
		items: [
			// Activity and the audit log read the same stream with different
			// questions in mind, so they are one destination with two tabs
			// rather than two rail entries an operator has to choose between
			// before knowing which one holds the answer.
			{ href: '/superadmin/activity', label: 'Activity & audit', icon: Activity },
			{ href: '/superadmin/health', label: 'System health', icon: HeartPulse }
		]
	},
	{
		label: 'Settings',
		// One destination. Settings is somewhere you go to change one thing and
		// leave; five rail entries made the console's top-level navigation
		// mostly about configuration, which is not what the day is spent on.
		items: [{ href: '/superadmin/settings', label: 'Settings', icon: SlidersHorizontal }]
	}
];

/**
 * Destinations reached from the account menu rather than the rail.
 *
 * Your own account belongs under your own avatar, which is where every operator
 * looks for it first — and it is a section of Settings, not a sibling of it.
 */
export const ACCOUNT_LINKS = [
	{ href: '/superadmin/settings?section=profile', label: 'Your profile' }
];

/** Every destination in the rail, flattened. Used by the nav checks. */
export function navItems(): AdminNavItem[] {
	return SUPERADMIN_NAV.flatMap((group) => group.items);
}

/**
 * Is this rail entry the one that should be lit?
 *
 * Mirrors SidebarNavLink's own rule so the checks and the component cannot
 * drift: exact entries match only themselves, everything else also matches its
 * children, minus any path that belongs to a sibling.
 */
export function isAdminNavActive(pathname: string, item: AdminNavItem): boolean {
	const path = normalize(pathname);
	if (path === item.href) return true;
	if (item.exact) return false;
	if ((item.exclude ?? []).some((ex) => path === ex || path.startsWith(ex + '/'))) return false;
	return path.startsWith(item.href + '/');
}

/* ------------------------------------------------------------------ *
 * Titles and trails
 * ------------------------------------------------------------------ */

/** Context the trail needs to name things it cannot read from the path. */
export type AdminNavContext = {
	/** Businesses already loaded by the shell, for id → name resolution. */
	businesses?: { id: string; name: string }[];
	/** The active tab on a detail page, surfaced as the final crumb. */
	tab?: string | null;
};

/** Exact-path titles. Anything unlisted is derived from its last segment. */
const TITLES: Record<string, string> = {
	'/superadmin': 'Dashboard',
	'/superadmin/businesses': 'All businesses',
	'/superadmin/businesses/new': 'Onboard a business',
	'/superadmin/plans': 'Plans & subscriptions',
	'/superadmin/iam': 'Users & IAM',
	'/superadmin/providers': 'Providers & integrations',
	'/superadmin/notifications': 'Notifications',
	'/superadmin/activity': 'Activity & audit',
	'/superadmin/health': 'System health',
	'/superadmin/settings': 'Settings'
};

/** Labels for path segments that are not a destination of their own. */
const SEGMENT_LABELS: Record<string, string> = {
	superadmin: 'Super Admin',
	businesses: 'Businesses',
	plans: 'Plans',
	iam: 'Users & IAM',
	providers: 'Providers',
	notifications: 'Notifications',
	activity: 'Activity',
	health: 'System health',
	settings: 'Settings',
	branding: 'Branding',
	security: 'Security',
	'business-types': 'Business types',
	profile: 'Admin profile',
	new: 'Onboard',
	smtp: 'Email / SMTP',
	storage: 'Storage',
	ai: 'AI'
};

/** Tabs on the business workspace, as they appear in the trail. */
const TAB_LABELS: Record<string, string> = {
	overview: 'Overview',
	users: 'Users',
	subscription: 'Subscription',
	configuration: 'Configuration',
	activity: 'Activity',
	audit: 'Audit'
};

export type AdminCrumb = { label: string; href: string | null };

/** Topbar title for a Super Admin route. */
export function adminTitle(pathname: string, ctx: AdminNavContext = {}): string {
	const path = normalize(pathname);
	const exact = TITLES[path];
	if (exact) return exact;

	const business = businessIdIn(path);
	if (business) return nameOf(business, ctx) ?? 'Business';

	const segments = path.split('/').filter(Boolean);
	const last = segments[segments.length - 1] ?? '';
	return SEGMENT_LABELS[last] ?? humanise(last);
}

/**
 * Build the trail, e.g. Super Admin / Businesses / Momo Magic / Subscription.
 * Every crumb but the last links somewhere you can actually go back to.
 */
export function adminCrumbs(pathname: string, ctx: AdminNavContext = {}): AdminCrumb[] {
	const path = normalize(pathname);
	const segments = path.split('/').filter(Boolean);
	if (segments[0] !== 'superadmin') return [];

	const crumbs: AdminCrumb[] = [];
	segments.forEach((seg, i) => {
		const href = '/' + segments.slice(0, i + 1).join('/');
		const label = SEGMENT_LABELS[seg] ?? nameOf(seg, ctx) ?? humanise(seg);
		crumbs.push({ label, href });
	});

	// A tab is part of "where am I", so it becomes the leaf when there is one.
	const tab = ctx.tab ? TAB_LABELS[ctx.tab] : undefined;
	if (tab) crumbs.push({ label: tab, href: null });

	if (crumbs.length > 0) {
		crumbs[crumbs.length - 1] = { ...crumbs[crumbs.length - 1], href: null };
	}
	return crumbs;
}

/** True on any business-scoped route, where the onboarding action belongs. */
export function isBusinessSection(pathname: string): boolean {
	const path = normalize(pathname);
	return path === '/superadmin/businesses' || path.startsWith('/superadmin/businesses/');
}

/** The onboarding wizard needs the full content width. */
export function isOnboardingPage(pathname: string): boolean {
	return normalize(pathname) === '/superadmin/businesses/new';
}

/** The business id in a detail path, or null. */
export function businessIdIn(pathname: string): string | null {
	const match = /^\/superadmin\/businesses\/([^/]+)$/.exec(normalize(pathname));
	if (!match) return null;
	return match[1] === 'new' ? null : match[1];
}

function nameOf(id: string, ctx: AdminNavContext): string | undefined {
	return ctx.businesses?.find((b) => b.id === id)?.name;
}

function normalize(pathname: string): string {
	return pathname.replace(/\/+$/, '') || '/';
}

function humanise(v: string): string {
	if (!v) return 'Super Admin';
	return v.charAt(0).toUpperCase() + v.slice(1).replaceAll('-', ' ');
}
