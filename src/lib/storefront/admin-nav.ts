import type { Component } from 'svelte';
import Image from '@lucide/svelte/icons/image';
import LayoutTemplate from '@lucide/svelte/icons/layout-template';
import Palette from '@lucide/svelte/icons/palette';
import Smartphone from '@lucide/svelte/icons/smartphone';
import Store from '@lucide/svelte/icons/store';

/**
 * Storefront Customize navigation.
 *
 * Preview and QR live on the tenant rail as their own destinations.
 * Opening hours, QR and Preview live under /shop/storefront; payments has its
 * own destination and order workflow is a section of Settings.
 * This list is only the Customize hub: look, homepage, and customer login.
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
		label: 'Overview',
		description: 'How your storefront looks and whether it is live',
		icon: Store
	},
	{
		href: '/shop/customize/branding',
		label: 'Branding',
		description: 'Logo, favicon and the name customers see',
		icon: Image
	},
	{
		href: '/shop/customize/theme',
		label: 'Theme',
		description: 'Colours, fonts, buttons and cards',
		icon: Palette
	},
	{
		href: '/shop/customize/homepage',
		label: 'Homepage',
		description: 'Choose and order the sections on your home page',
		icon: LayoutTemplate
	},
	{
		href: '/shop/customize/login',
		label: 'Customer login',
		description: 'Whether customers can sign in with their phone',
		icon: Smartphone
	}
];

/** Paths that show the Customize sidebar shell (not /shop/customize Studio workspace). */
const CUSTOMIZE_SHELL_PATHS = [
	'/shop/customize/branding',
	'/shop/customize/theme',
	'/shop/customize/homepage',
	'/shop/customize/login'
];

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
	// Exact for the overview, so visiting a screen does not leave it lit too.
	if (item.href === '/shop/customize') return path === item.href;
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
	payments: 'Payments',
	workflow: 'Order Workflow',
	qr: 'QR & Share',
	preview: 'Preview'
};

/** The label for a storefront screen, or `null` when the segment is unknown. */
export function storefrontSegmentLabel(segment: string): string | null {
	return STOREFRONT_SEGMENT_LABELS[segment] ?? null;
}
