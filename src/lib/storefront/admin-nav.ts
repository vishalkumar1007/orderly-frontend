import type { Component } from 'svelte';
import Store from '@lucide/svelte/icons/store';

/**
 * Storefront Customize navigation.
 *
 * Preview and Publish & Marketing live under /shop/storefront.
 * Opening hours live under Action; payments has its
 * own destination and order workflow is a section of Settings.
 * Legacy section URLs redirect into Studio (`/shop/customize?section=…`).
 * This list is the Customize hub entry only.
 */
export type StorefrontNavItem = {
	href: string;
	label: string;
	description: string;
	icon: Component;
};

/**
 * Customize screens, in the order a shopkeeper typically configures them.
 *
 * `isStorefrontActive` always matches child paths, so a screen stays lit while
 * any sub-tab under it is open.
 */
export const STOREFRONT_NAV: StorefrontNavItem[] = [
	{
		href: '/shop/customize',
		label: 'Studio',
		description: 'Appearance, store rules, preview, and publish',
		icon: Store
	}
];

/** Paths that show the legacy Customize sidebar shell (empty — sections live in Studio). */
const CUSTOMIZE_SHELL_PATHS: string[] = [];

/** True when the Customize inner nav should wrap the page. */
export function isCustomizeShellPath(pathname: string): boolean {
	const path = pathname.replace(/\/+$/, '') || '/';
	return CUSTOMIZE_SHELL_PATHS.some(
		(href) => path === href || path.startsWith(href + '/')
	);
}

/** `isStorefrontActive` lights a nav item without lighting its siblings. */
export function isStorefrontActive(pathname: string, item: StorefrontNavItem): boolean {
	const path = pathname.replace(/\/+$/, '') || '/';
	// Studio hub and legacy section URLs that redirect into it.
	if (item.href === '/shop/customize') {
		if (path === item.href || path.startsWith(item.href + '?')) return true;
		return (
			path.startsWith('/shop/customize/') &&
			!path.startsWith('/shop/customize/preview-frame')
		);
	}
	return path === item.href || path.startsWith(item.href + '/');
}

/**
 * Breadcrumb and page-title wording for the storefront subtree — including
 * Preview and QR that are not in STOREFRONT_NAV.
 *
 * The overview is excluded deliberately. Its path segment is `storefront`, which
 * is also the section name; tenant crumbs map that segment to "Customize".
 */
export const STOREFRONT_SEGMENT_LABELS: Record<string, string> = {
	branding: 'Branding',
	theme: 'Theme',
	homepage: 'Homepage',
	login: 'Customer login',
	'store-info': 'Business Profile',
	hours: 'Operating Hours',
	actions: 'Action',
	promote: 'Publish & Marketing',
	launch: 'Publish & Marketing',
	payments: 'Payments',
	workflow: 'Order Workflow',
	qr: 'Publish & Marketing',
	preview: 'Preview'
};

/** The label for a storefront screen, or `null` when the segment is unknown. */
export function storefrontSegmentLabel(segment: string): string | null {
	return STOREFRONT_SEGMENT_LABELS[segment] ?? null;
}
