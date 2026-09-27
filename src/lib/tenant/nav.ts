import type { Component } from 'svelte';
import Activity from '@lucide/svelte/icons/activity';
import ChefHat from '@lucide/svelte/icons/chef-hat';
import ClipboardList from '@lucide/svelte/icons/clipboard-list';
import Clock from '@lucide/svelte/icons/clock';
import CreditCard from '@lucide/svelte/icons/credit-card';
import Eye from '@lucide/svelte/icons/eye';
import History from '@lucide/svelte/icons/history';
import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
import LayoutTemplate from '@lucide/svelte/icons/layout-template';
import ListOrdered from '@lucide/svelte/icons/list-ordered';
import MonitorPlay from '@lucide/svelte/icons/monitor-play';
import QrCode from '@lucide/svelte/icons/qr-code';
import Settings from '@lucide/svelte/icons/settings';
import Shield from '@lucide/svelte/icons/shield';
import Store from '@lucide/svelte/icons/store';
import Users from '@lucide/svelte/icons/users';
import UserCog from '@lucide/svelte/icons/user-cog';
import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
import { storefrontSegmentLabel } from '$lib/storefront/admin-nav';

export type ShopNavItem = {
	href: string;
	label: string;
	icon: Component;
	/** Show a live count badge sourced from this counter in the order store. */
	badge?: 'active' | 'new';
	/** Only show to these roles. Reserved for future IAM; layout still filters coarsely. */
	roles?: string[];
	/** Match nested paths too (e.g. /shop/tenants/[id]). */
	nested?: boolean;
	/** Match only this exact path, not its children. */
	exact?: boolean;
	/** Child paths that belong to a sibling entry. */
	exclude?: string[];
};

export type ShopNavGroup = {
	label?: string;
	/** Visual weight — RUNNING is the daily-ops cluster. */
	emphasis?: 'running';
	items: ShopNavItem[];
};

/** Staff default ops destinations (no management / org / storefront). */
export const STAFF_OPS_HREFS = new Set(['/shop/orders', '/shop/kitchen']);

/**
 * Storefront paths that are NOT part of Customize.
 * Preview and QR stay under /shop/storefront; they have their own rail entries.
 */
const STOREFRONT_SIBLING_EXCLUDES = [
	'/shop/storefront/preview',
	'/shop/storefront/qr'
];

/**
 * Legacy staff shell nav. Kept for check_nav and any leftover ShopShell usage;
 * the org portal uses TENANT_NAV. Kitchen now lives under /shop/kitchen.
 */
export const SHOP_NAV: ShopNavGroup[] = [
	{
		items: [{ href: '/shop', label: 'Dashboard', icon: LayoutDashboard }]
	},
	{
		label: 'Running',
		items: [
			{ href: '/shop/orders', label: 'Selling', icon: ClipboardList, badge: 'active' },
			{ href: '/shop/kitchen', label: 'Kitchen', icon: ChefHat, badge: 'active' },
			{ href: '/shop/menu', label: 'Menu', icon: UtensilsCrossed }
		]
	},
	{
		label: 'Storefront',
		items: [
			{ href: '/shop/setup', label: 'Launch checklist', icon: LayoutTemplate, nested: true },
			{ href: '/', label: 'View live site', icon: Store }
		]
	}
];

/**
 * The five destinations that fit a phone's bottom bar. "More" opens the drawer
 * for everything else — a tab bar with more than five items stops being
 * thumb-friendly.
 */
export const SHOP_TABS: ShopNavItem[] = [
	{ href: '/shop', label: 'Home', icon: LayoutDashboard },
	{ href: '/shop/orders', label: 'Selling', icon: ClipboardList, badge: 'active' },
	{ href: '/shop/menu', label: 'Menu', icon: UtensilsCrossed },
	{ href: '/shop/kitchen', label: 'Kitchen', icon: ChefHat, badge: 'active' }
];

/** `/shop` must not light up while you are on `/shop/orders`. */
export function isActive(pathname: string, item: ShopNavItem): boolean {
	const path = pathname.replace(/\/+$/, '') || '/';
	if (item.href === '/') return path === '/';
	if (!item.nested && path === item.href) return true;
	return item.nested ? path === item.href || path.startsWith(item.href + '/') : false;
}

/**
 * App-bar titles, derived from the route. The shell renders above every page,
 * so pages cannot hand it a title as a prop — the route is the single source
 * of truth, which also keeps the browser tab and the app bar in agreement.
 */
const TITLES: Array<[string, string]> = [
	['/shop/kitchen', 'Kitchen'],
	['/shop/orders', 'Selling'],
	['/shop/menu', 'Menu'],
	['/shop/setup', 'Launch checklist'],
	['/shop/brand', 'Console appearance'],
	['/shop', 'Dashboard']
];

export function titleFor(pathname: string, shopName: string): string {
	const path = pathname.replace(/\/+$/, '') || '/';
	for (const [prefix, title] of TITLES) {
		if (path === prefix) return title;
	}
	// Unknown /shop/* sub-route: fall back to the shop name so the bar is never blank.
	return shopName || 'Orderly';
}

/* ------------------------------------------------------------------ *
 * Organization admin portal (the /shop/* shell)
 *
 * The same rail the Super Admin uses, driven by the same component. Only the
 * entries and the route labels differ, so both portals share one design system
 * instead of drifting apart.
 * ------------------------------------------------------------------ */

/** Sidebar for the organization admin portal. */
export const TENANT_NAV: ShopNavGroup[] = [
	{
		label: 'Overview',
		items: [
			{
				href: '/shop',
				label: 'Dashboard',
				icon: LayoutDashboard,
				exact: true,
				roles: ['TENANT_ADMIN']
			}
		]
	},
	{
		label: 'Running',
		emphasis: 'running',
		items: [
			{
				href: '/shop/orders',
				label: 'Selling',
				icon: ClipboardList,
				nested: true,
				badge: 'active',
				roles: ['TENANT_ADMIN', 'STAFF']
			},
			{
				href: '/shop/kitchen',
				label: 'Kitchen',
				icon: ChefHat,
				exact: true,
				badge: 'active',
				roles: ['TENANT_ADMIN', 'STAFF']
			},
			{
				href: '/shop/live',
				label: 'Live Activity',
				icon: MonitorPlay,
				exact: true,
				roles: ['TENANT_ADMIN']
			}
		]
	},
	{
		label: 'Management',
		items: [
			{
				href: '/shop/menu',
				label: 'Menu',
				icon: UtensilsCrossed,
				nested: true,
				roles: ['TENANT_ADMIN']
			},
			{
				href: '/shop/customers',
				label: 'Customers',
				icon: Users,
				nested: true,
				roles: ['TENANT_ADMIN']
			},
			{
				href: '/shop/staff',
				label: 'Staff',
				icon: UserCog,
				nested: true,
				roles: ['TENANT_ADMIN']
			}
		]
	},
	{
		label: 'Storefront',
		items: [
			{
				href: '/shop/customize',
				label: 'Customize',
				icon: LayoutTemplate,
				nested: true,
				roles: ['TENANT_ADMIN']
			},
			{
				href: '/shop/storefront/preview',
				label: 'Preview',
				icon: Eye,
				exact: true,
				roles: ['TENANT_ADMIN']
			},
			{
				href: '/shop/storefront/qr',
				label: 'QR & Share',
				icon: QrCode,
				exact: true,
				roles: ['TENANT_ADMIN']
			}
		]
	},
	{
		label: 'Organization',
		items: [
			{
				href: '/shop/organization/hours',
				label: 'Operating Hours',
				icon: Clock,
				exact: true,
				roles: ['TENANT_ADMIN']
			},
			{
				href: '/shop/organization/payments',
				label: 'Payments',
				icon: CreditCard,
				exact: true,
				roles: ['TENANT_ADMIN']
			},
			{
				href: '/shop/organization/workflow',
				label: 'Order Workflow',
				icon: ListOrdered,
				exact: true,
				roles: ['TENANT_ADMIN']
			},
			{
				href: '/shop/iam',
				label: 'IAM',
				icon: Shield,
				nested: true,
				roles: ['TENANT_ADMIN']
			},
			{
				href: '/shop/settings',
				label: 'Settings',
				icon: Settings,
				nested: true,
				roles: ['TENANT_ADMIN']
			}
		]
	},
	{
		label: 'Activity',
		items: [
			{
				href: '/shop/order-history',
				label: 'Order History',
				icon: History,
				nested: true,
				roles: ['TENANT_ADMIN']
			},
			{
				href: '/shop/activity',
				label: 'Activity Logs',
				icon: Activity,
				nested: true,
				roles: ['TENANT_ADMIN']
			}
		]
	}
];

/** Human labels for trail segments under /shop. */
const TENANT_SEGMENT_LABELS: Record<string, string> = {
	orders: 'Selling',
	menu: 'Menu',
	kitchen: 'Kitchen',
	live: 'Live Activity',
	customers: 'Customers',
	staff: 'Staff',
	setup: 'Launch checklist',
	brand: 'Console appearance',
	customize: 'Customize',
	storefront: 'Storefront',
	organization: 'Organization',
	notifications: 'Notifications',
	integrations: 'Integrations',
	iam: 'IAM',
	settings: 'Settings',
	smtp: 'Email / SMTP',
	storage: 'Storage',
	ai: 'AI',
	hours: 'Operating Hours',
	payments: 'Payments',
	workflow: 'Order Workflow',
	'business-profile': 'Business Profile',
	'order-history': 'Order History',
	activity: 'Activity Logs',
	products: 'Products',
	categories: 'Categories',
	new: 'New',
	edit: 'Edit'
};

/** The first crumb stands in for the shop root. */
const TENANT_ROOT_LABEL = 'Overview';

export type TenantCrumb = { label: string; href: string | null };

/**
 * Label for one segment of a `/shop/*` path.
 *
 * `index` is an index into the *full* path, with or without a leading `shop`.
 * Both call sites resolve against the same array on purpose: an earlier version
 * let `tenantTitle` pass the whole path and `tenantCrumbs` pass the shop-stripped
 * one, and the storefront check below silently stopped matching for the caller
 * that used the other convention — which showed up as "Opening hours" rendering
 * as "Hours" in the page title while the breadcrumb was right.
 *
 * Inside `/shop/storefront/*` the storefront navigation owns the wording, because
 * those segment names repeat with a different meaning elsewhere — `login` is a
 * customer setting under `/shop/storefront` and the staff sign-in page on its own.
 */
function segmentLabel(segments: string[], index: number): string {
	const seg = segments[index];
	if ((segments[1] === 'storefront' || segments[1] === 'customize') && index >= 2) {
		return storefrontSegmentLabel(seg) ?? humanise(seg);
	}
	if (segments[1] === 'organization' && index >= 2) {
		return TENANT_SEGMENT_LABELS[seg] ?? humanise(seg);
	}
	return TENANT_SEGMENT_LABELS[seg] ?? humanise(seg);
}

/**
 * Build a navigable trail for a tenant route, e.g.
 * Overview / Customize / Theme.
 *
 * Every crumb except the last links somewhere real.
 */
export function tenantCrumbs(pathname: string): TenantCrumb[] {
	const segments = pathname.split('/').filter(Boolean);
	if (segments[0] !== 'shop') return [];

	const crumbs: TenantCrumb[] = [{ label: TENANT_ROOT_LABEL, href: '/shop' }];
	const rest = segments.slice(1);

	rest.forEach((seg, i) => {
		const isLast = i === rest.length - 1;
		const href = '/' + ['shop', ...rest.slice(0, i + 1)].join('/');
		const label = segmentLabel(segments, i + 1);
		crumbs.push({ label, href: isLast ? null : href });
	});

	return crumbs;
}

/** Topbar title for a tenant route. */
export function tenantTitle(pathname: string): string {
	const segments = pathname.split('/').filter(Boolean);
	if (segments[0] !== 'shop') return 'Dashboard';
	if (segments.length <= 1) return 'Dashboard';
	return segmentLabel(segments, segments.length - 1);
}

/** Kitchen and Live Activity can drop the admin chrome for TV / prep displays. */
export function isOpsFullscreenPath(pathname: string): boolean {
	const path = pathname.replace(/\/+$/, '') || '/';
	return path === '/shop/kitchen' || path === '/shop/live';
}

function humanise(v: string): string {
	return v.charAt(0).toUpperCase() + v.slice(1).replaceAll('-', ' ');
}
