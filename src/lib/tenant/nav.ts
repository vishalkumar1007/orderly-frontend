import type { Component } from 'svelte';
import ChefHat from '@lucide/svelte/icons/chef-hat';
import ClipboardList from '@lucide/svelte/icons/clipboard-list';
import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
import Mail from '@lucide/svelte/icons/mail';
import Sparkles from '@lucide/svelte/icons/sparkles';
import ListChecks from '@lucide/svelte/icons/list-checks';
import LayoutTemplate from '@lucide/svelte/icons/layout-template';
import Palette from '@lucide/svelte/icons/palette';
import Store from '@lucide/svelte/icons/store';
import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
import { storefrontSegmentLabel } from '$lib/storefront/admin-nav';

export type ShopNavItem = {
	href: string;
	label: string;
	icon: Component;
	/** Show a live count badge sourced from this counter in the order store. */
	badge?: 'active' | 'new';
	/** Only show to these roles. */
	roles?: string[];
	/** Match nested paths too (e.g. /shop/tenants/[id]). */
	nested?: boolean;
	/** Match only this exact path, not its children. */
	exact?: boolean;
	/** Child paths that belong to a sibling entry. */
	exclude?: string[];
};

export type ShopNavGroup = { label?: string; items: ShopNavItem[] };

/** Full navigation, shown in the left rail / drawer. */
export const SHOP_NAV: ShopNavGroup[] = [
	{
		items: [{ href: '/shop', label: 'Dashboard', icon: LayoutDashboard }]
	},
	{
		label: 'Selling',
		items: [
			{ href: '/shop/orders', label: 'Orders', icon: ClipboardList, badge: 'active' },
			{ href: '/kitchen', label: 'Kitchen', icon: ChefHat, badge: 'active' },
			{ href: '/shop/menu', label: 'Menu', icon: UtensilsCrossed }
		]
	},
	{
		label: 'Store',
		items: [
			{ href: '/shop/setup', label: 'Setup', icon: ListChecks, nested: true },
			{ href: '/shop/brand', label: 'Brand', icon: Palette, nested: true },
			{ href: '/', label: 'View storefront', icon: Store }
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
	{ href: '/shop/orders', label: 'Orders', icon: ClipboardList, badge: 'active' },
	{ href: '/shop/menu', label: 'Menu', icon: UtensilsCrossed },
	{ href: '/kitchen', label: 'Kitchen', icon: ChefHat, badge: 'active' }
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
	['/kitchen', 'Kitchen board'],
	['/shop/orders', 'Orders'],
	['/shop/menu', 'Menu'],
	['/shop/setup', 'Setup'],
	['/shop/brand', 'Brand'],
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
		items: [
			// Exact, so the dashboard does not stay lit while browsing orders.
			{ href: '/shop', label: 'Dashboard', icon: LayoutDashboard, exact: true }
		]
	},
	{
		label: 'Selling',
		items: [
			{ href: '/shop/orders', label: 'Orders', icon: ClipboardList, nested: true },
			{ href: '/shop/menu', label: 'Menu', icon: UtensilsCrossed, nested: true },
			{ href: '/kitchen', label: 'Kitchen', icon: ChefHat, exact: true }
		]
	},
	{
		label: 'Store',
		items: [
			{ href: '/shop/setup', label: 'Setup', icon: ListChecks, nested: true },
			{ href: '/shop/brand', label: 'Brand', icon: Palette, nested: true },
			{ href: '/shop/storefront', label: 'Storefront', icon: LayoutTemplate, nested: true },
			{ href: '/shop/settings/smtp', label: 'Email / SMTP', icon: Mail, nested: true },
			{ href: '/shop/settings/storage', label: 'Storage', icon: Store, nested: true },
			{ href: '/shop/settings/ai', label: 'AI', icon: Sparkles, nested: true }
		]
	}
];

/** Human labels for trail segments under /shop. */
const TENANT_SEGMENT_LABELS: Record<string, string> = {
	orders: 'Orders',
	menu: 'Menu',
	setup: 'Setup',
	brand: 'Brand',
	storefront: 'Storefront',
	settings: 'Settings',
	smtp: 'Email / SMTP',
	storage: 'Storage',
	ai: 'AI',
	products: 'Products',
	categories: 'Categories',
	new: 'New',
	edit: 'Edit'
};

/** Segments that group a section but have no page of their own. */
const SECTION_SEGMENTS = new Set(['settings']);

/** The first crumb stands in for the shop root. */
const TENANT_ROOT_LABEL = 'Overview';

export type TenantCrumb = { label: string; href: string | null };

/**
 * Label for one segment of a `/shop/*` path.
 *
 * Inside `/shop/storefront/*` the storefront navigation owns the wording, because
 * those segment names repeat with a different meaning elsewhere — `login` is a
 * customer setting under `/shop/storefront` and the staff sign-in page on its own.
 */
function segmentLabel(segments: string[], index: number): string {
	const seg = segments[index];
	if (segments[0] === 'storefront' && index >= 1) {
		return storefrontSegmentLabel(seg) ?? humanise(seg);
	}
	return TENANT_SEGMENT_LABELS[seg] ?? humanise(seg);
}

/**
 * Build a navigable trail for a tenant route, e.g.
 * Overview / Storefront / Theme.
 *
 * Every crumb except the last links somewhere real. `settings` is a grouping
 * segment with no page, so it inherits the previous crumb's target rather than
 * offering a dead link.
 */
export function tenantCrumbs(pathname: string): TenantCrumb[] {
	const segments = pathname.split('/').filter(Boolean);
	if (segments[0] !== 'shop') return [];

	const crumbs: TenantCrumb[] = [{ label: TENANT_ROOT_LABEL, href: '/shop' }];
	const rest = segments.slice(1);

	rest.forEach((seg, i) => {
		const isLast = i === rest.length - 1;
		const href = '/' + ['shop', ...rest.slice(0, i + 1)].join('/');
		const label = segmentLabel(rest, i);

		if (SECTION_SEGMENTS.has(seg)) {
			// No page lives here; point at wherever the trail already points so
			// the crumb is still a way back.
			crumbs.push({ label, href: crumbs[crumbs.length - 1].href });
			return;
		}
		crumbs.push({ label, href: isLast ? null : href });
	});

	return crumbs;
}

/** Topbar title for a tenant route. */
export function tenantTitle(pathname: string): string {
	const segments = pathname.split('/').filter(Boolean);
	if (segments[0] === 'kitchen') return 'Kitchen board';
	if (segments[0] !== 'shop') return 'Dashboard';
	if (segments.length <= 1) return 'Dashboard';
	return segmentLabel(segments, segments.length - 1);
}

function humanise(v: string): string {
	return v.charAt(0).toUpperCase() + v.slice(1).replaceAll('-', ' ');
}
