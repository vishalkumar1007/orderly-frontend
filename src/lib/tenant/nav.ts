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
import MonitorPlay from '@lucide/svelte/icons/monitor-play';
import QrCode from '@lucide/svelte/icons/qr-code';
import Settings from '@lucide/svelte/icons/settings';
import Shield from '@lucide/svelte/icons/shield';
import Store from '@lucide/svelte/icons/store';
import Users from '@lucide/svelte/icons/users';
import UserCog from '@lucide/svelte/icons/user-cog';
import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
import { storefrontSegmentLabel } from '$lib/storefront/admin-nav';
import { hasModule, termsFor, type ModuleKey, type Terminology } from '$lib/admin/businessTypes';

export type ShopNavItem = {
	href: string;
	/**
	 * The default label. `labelFor` overrides it when the business type has
	 * its own word — a grocer's board is Packing, a cafe's is the Bar.
	 */
	label: string;
	icon: Component;
	/** Only show when the business type enables this module. */
	module?: ModuleKey;
	/** Take the label from the type's vocabulary instead of the default. */
	term?: 'catalog' | 'station' | 'orders' | 'staff';
	/** Show a live count badge sourced from this counter in the order store. */
	badge?: 'active' | 'new';
	/**
	 * The capability this destination needs. The signed-in user's permission
	 * list comes from the API, so the rail shows exactly what the API allows —
	 * a manager sees the menu but not the storefront, and neither the rail nor
	 * the server has to know about the other's rules.
	 */
	permission?: ShopPermission;
	/** Legacy coarse filter, kept for the staff shell. Prefer `permission`. */
	roles?: string[];
	/** Match nested paths too (e.g. /shop/tenants/[id]). */
	nested?: boolean;
	/** Match only this exact path, not its children. */
	exact?: boolean;
	/** Child paths that belong to a sibling entry. */
	exclude?: string[];
};

/** Capabilities the API grants a business user. Mirrors pkg/identity. */
export type ShopPermission =
	| 'selling'
	| 'kitchen'
	| 'live_activity'
	| 'menu'
	| 'customers'
	| 'staff'
	| 'storefront'
	| 'organization'
	| 'integrations'
	| 'iam'
	| 'settings'
	| 'analytics'
	| 'activity';

export type ShopNavGroup = {
	label?: string;
	/** Visual weight — RUNNING is the daily-ops cluster. */
	emphasis?: 'running';
	items: ShopNavItem[];
};

/** Staff default ops destinations (no management / org / storefront). */
export const STAFF_OPS_HREFS = new Set(['/shop/orders', '/shop/kitchen']);

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

/**
 * The label this destination carries for a business type.
 *
 * A console that calls a grocer's catalogue a "Menu" is software written for
 * somebody else, and the people using it notice immediately.
 */
export function labelFor(item: ShopNavItem, businessType: string | null | undefined): string {
	if (!item.term) return item.label;
	const terms = termsFor(businessType);
	switch (item.term) {
		case 'catalog':
			return terms.catalog;
		case 'station':
			return terms.station;
		case 'orders':
			return terms.orders;
		case 'staff':
			return terms.staff;
		default:
			return item.label;
	}
}

/**
 * Does this business type include this destination?
 *
 * Absence is rare and deliberate: a module is hidden only when it would be
 * meaningless, never merely unused. Everything else is relabelled instead, so
 * no screen disappears because somebody picked a type.
 */
export function inModules(item: ShopNavItem, businessType: string | null | undefined): boolean {
	if (!item.module) return true;
	return hasModule(businessType, item.module);
}

/**
 * Can this user open this destination?
 *
 * Permissions win when the API supplied them. The role list is the fallback for
 * a session that predates permissions — the rail degrades to what it used to
 * do rather than emptying itself.
 */
export function canOpen(
	item: ShopNavItem,
	permissions: readonly string[] | undefined,
	role: string | undefined
): boolean {
	if (item.permission && permissions && permissions.length > 0) {
		return permissions.includes(item.permission);
	}
	if (item.roles && role) return item.roles.includes(role);
	// An entry with neither constraint is open to anyone signed in.
	return !item.roles || !role ? true : false;
}

/**
 * The rail for one person in one business: their permissions decide what they
 * may open, the business type decides what it is called and whether it applies.
 */
export function visibleGroups(
	groups: ShopNavGroup[],
	permissions: readonly string[] | undefined,
	role: string | undefined,
	businessType?: string | null
): ShopNavGroup[] {
	return groups
		.map((group) => ({
			...group,
			items: group.items
				.filter((item) => canOpen(item, permissions, role) && inModules(item, businessType))
				.map((item) => ({ ...item, label: labelFor(item, businessType) }))
		}))
		.filter((group) => group.items.length > 0);
}

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
				permission: 'analytics'
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
				permission: 'selling'
			},
			{
				href: '/shop/kitchen',
				label: 'Kitchen',
				term: 'station',
				module: 'station',
				icon: ChefHat,
				exact: true,
				badge: 'active',
				permission: 'kitchen'
			},
			{
				href: '/shop/live',
				label: 'Live Activity',
				module: 'live_display',
				icon: MonitorPlay,
				exact: true,
				permission: 'live_activity'
			}
		]
	},
	{
		label: 'Management',
		items: [
			{
				href: '/shop/menu',
				label: 'Menu',
				term: 'catalog',
				icon: UtensilsCrossed,
				nested: true,
				permission: 'menu'
			},
			{
				href: '/shop/customers',
				label: 'Customers',
				icon: Users,
				nested: true,
				permission: 'customers'
			},
			{
				href: '/shop/staff',
				label: 'Staff',
				term: 'staff',
				icon: UserCog,
				nested: true,
				permission: 'staff'
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
				permission: 'storefront'
			},
			{
				/*
				 * Opening hours sit with the storefront because that is what
				 * they change: whether a customer can order right now. The
				 * capability stays `organization` because that is what the API
				 * enforces on the write — the rail groups by what a screen is
				 * about, never by who may open it.
				 */
				href: '/shop/storefront/hours',
				label: 'Operating Hours',
				icon: Clock,
				exact: true,
				permission: 'organization'
			},
			{
				href: '/shop/storefront/preview',
				label: 'Preview',
				icon: Eye,
				exact: true,
				permission: 'storefront'
			},
			{
				href: '/shop/storefront/qr',
				label: 'QR & Share',
				icon: QrCode,
				exact: true,
				permission: 'storefront'
			}
		]
	},
	{
		/*
		 * Three destinations, not eight.
		 *
		 * Everything else that used to sit here — business profile, order
		 * workflow, notifications, integrations, console appearance — is
		 * configuration you open to change one thing and leave, so it lives as
		 * a section inside Settings rather than as a permanent entry in the
		 * rail. Payments and IAM stay out because they are the two an owner
		 * checks on their own, not as part of a settings pass.
		 */
		label: 'Organization',
		items: [
			{
				href: '/shop/payments',
				label: 'Payments',
				icon: CreditCard,
				exact: true,
				permission: 'organization'
			},
			{
				href: '/shop/iam',
				label: 'IAM',
				icon: Shield,
				nested: true,
				permission: 'iam'
			},
			{
				href: '/shop/settings',
				label: 'Settings',
				icon: Settings,
				nested: true,
				permission: 'settings'
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
				permission: 'activity'
			},
			{
				href: '/shop/activity',
				label: 'Audit Log',
				icon: Activity,
				nested: true,
				permission: 'activity'
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
	customize: 'Customize',
	storefront: 'Storefront',
	notifications: 'Notifications',
	integrations: 'Integrations',
	iam: 'IAM',
	settings: 'Settings',
	appearance: 'Appearance',
	smtp: 'Email / SMTP',
	storage: 'Storage',
	ai: 'AI',
	hours: 'Operating Hours',
	payments: 'Payments',
	workflow: 'Order Workflow',
	'business-profile': 'Business Profile',
	'order-history': 'Order History',
	activity: 'Audit Log',
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
/**
 * Segments whose wording belongs to the business, not to the platform.
 *
 * A grocer's `kitchen` is the packing bench and a hotel's is the service desk;
 * `menu` is a menu in a cafe and a catalogue in a shop. The route keeps its
 * stable path — only the word on screen moves — so links, bookmarks and the
 * navigation checks all stay valid.
 */
const TERM_SEGMENTS: Record<string, (t: Terminology) => string> = {
	kitchen: (t) => t.station,
	menu: (t) => t.catalog,
	staff: (t) => t.staff,
	products: (t) => t.items,
	categories: (t) => t.groups,
	'order-history': (t) => `${t.order} history`
};

function segmentLabel(segments: string[], index: number, businessType?: string | null): string {
	const seg = segments[index];
	if ((segments[1] === 'storefront' || segments[1] === 'customize') && index >= 2) {
		return storefrontSegmentLabel(seg) ?? humanise(seg);
	}
	const term = TERM_SEGMENTS[seg];
	if (term) return term(termsFor(businessType));
	return TENANT_SEGMENT_LABELS[seg] ?? humanise(seg);
}

/**
 * Build a navigable trail for a tenant route, e.g.
 * Overview / Customize / Theme.
 *
 * Every crumb except the last links somewhere real.
 */
export function tenantCrumbs(pathname: string, businessType?: string | null): TenantCrumb[] {
	const segments = pathname.split('/').filter(Boolean);
	if (segments[0] !== 'shop') return [];

	const crumbs: TenantCrumb[] = [{ label: TENANT_ROOT_LABEL, href: '/shop' }];
	const rest = segments.slice(1);

	rest.forEach((seg, i) => {
		const isLast = i === rest.length - 1;
		const href = '/' + ['shop', ...rest.slice(0, i + 1)].join('/');
		const label = segmentLabel(segments, i + 1, businessType);
		crumbs.push({ label, href: isLast ? null : href });
	});

	return crumbs;
}

/** Topbar title for a tenant route. */
export function tenantTitle(pathname: string, businessType?: string | null): string {
	const segments = pathname.split('/').filter(Boolean);
	if (segments[0] !== 'shop') return 'Dashboard';
	if (segments.length <= 1) return 'Dashboard';
	return segmentLabel(segments, segments.length - 1, businessType);
}

/** Kitchen and Live Activity can drop the admin chrome for TV / prep displays. */
export function isOpsFullscreenPath(pathname: string): boolean {
	const path = pathname.replace(/\/+$/, '') || '/';
	return path === '/shop/kitchen' || path === '/shop/live';
}

function humanise(v: string): string {
	return v.charAt(0).toUpperCase() + v.slice(1).replaceAll('-', ' ');
}
