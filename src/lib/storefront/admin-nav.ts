import type { Component } from 'svelte';
import Clock from '@lucide/svelte/icons/clock';
import CreditCard from '@lucide/svelte/icons/credit-card';
import Eye from '@lucide/svelte/icons/eye';
import Image from '@lucide/svelte/icons/image';
import LayoutTemplate from '@lucide/svelte/icons/layout-template';
import ListOrdered from '@lucide/svelte/icons/list-ordered';
import Palette from '@lucide/svelte/icons/palette';
import QrCode from '@lucide/svelte/icons/qr-code';
import Smartphone from '@lucide/svelte/icons/smartphone';
import Store from '@lucide/svelte/icons/store';

/**
 * Storefront control navigation.
 *
 * The order here is the order a shopkeeper configures things in: what it looks
 * like, what it says, when it is open, who can sign in, how it takes money, how
 * orders move, and finally how to share it. Each screen writes to one part of the
 * same configuration document, so nothing overlaps.
 */
export type StorefrontNavItem = {
	href: string;
	label: string;
	description: string;
	icon: Component;
};

/**
 * The screens, in the order a shopkeeper configures them.
 *
 * `isStorefrontActive` always matches child paths, so a screen stays lit while
 * any sub-tab under it is open. An earlier version gated that on a per-item
 * `nested` flag, and the two entries that were missed — Branding and Theme —
 * simply never highlighted, which reads as a dead link rather than as a bug.
 * A flag every entry has to remember is a bug waiting for the next entry.
 */
export const STOREFRONT_NAV: StorefrontNavItem[] = [
	{
		href: '/shop/storefront',
		label: 'Overview',
		description: 'How your storefront looks and whether it is live',
		icon: Store
	},
	{
		href: '/shop/storefront/branding',
		label: 'Branding',
		description: 'Logo, favicon and the name customers see',
		icon: Image
	},
	{
		href: '/shop/storefront/theme',
		label: 'Theme',
		description: 'Colours, fonts, buttons and cards',
		icon: Palette
	},
	{
		href: '/shop/storefront/homepage',
		label: 'Homepage',
		description: 'Choose and order the sections on your home page',
		icon: LayoutTemplate
	},
	{
		href: '/shop/storefront/store-info',
		label: 'Store information',
		description: 'Description, phone and pickup address',
		icon: Store
	},
	{
		href: '/shop/storefront/hours',
		label: 'Opening hours',
		description: 'When customers can order',
		icon: Clock
	},
	{
		href: '/shop/storefront/login',
		label: 'Customer login',
		description: 'Whether customers can sign in with their phone',
		icon: Smartphone
	},
	{
		href: '/shop/storefront/payments',
		label: 'Payments',
		description: 'Online payment and cash at pickup',
		icon: CreditCard
	},
	{
		href: '/shop/storefront/workflow',
		label: 'Order workflow',
		description: 'Acceptance, payment timing and auto-complete',
		icon: ListOrdered
	},
	{
		href: '/shop/storefront/qr',
		label: 'QR code',
		description: 'Share your storefront on a sticker or a table tent',
		icon: QrCode
	},
	{
		href: '/shop/storefront/preview',
		label: 'Preview',
		description: 'See exactly what your customers see',
		icon: Eye
	}
];

/** `isStorefrontActive` lights a nav item without lighting its siblings. */
export function isStorefrontActive(pathname: string, item: StorefrontNavItem): boolean {
	const path = pathname.replace(/\/+$/, '') || '/';
	// Exact for the overview, so visiting a screen does not leave it lit too.
	if (item.href === '/shop/storefront') return path === item.href;
	return path === item.href || path.startsWith(item.href + '/');
}

/**
 * Breadcrumb and page-title wording for the storefront subtree, derived from the
 * navigation itself so a renamed screen cannot drift from the trail that links
 * to it.
 *
 * The overview is excluded deliberately. Its own path segment is `storefront`,
 * which is also the name of the section these labels live under, and a map that
 * said `storefront -> Overview` would be a trap for the next reader.
 *
 * It lives here because this subtree is the one place where a segment name is
 * ambiguous outside its parent: `/shop/storefront/login` is the customer sign-in
 * setting, while `/shop/login` is the staff sign-in page. Keying labels on the
 * segment alone would have to pick one meaning for both.
 */
export const STOREFRONT_SEGMENT_LABELS: Record<string, string> = Object.fromEntries(
	STOREFRONT_NAV.filter((item) => item.href !== '/shop/storefront').map((item) => [
		item.href.split('/').pop() ?? '',
		item.label
	])
);

/** The label for a storefront screen, or `null` when the segment is unknown. */
export function storefrontSegmentLabel(segment: string): string | null {
	return STOREFRONT_SEGMENT_LABELS[segment] ?? null;
}
