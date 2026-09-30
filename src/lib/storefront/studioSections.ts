import type { Component } from 'svelte';
import Clock from '@lucide/svelte/icons/clock';
import CreditCard from '@lucide/svelte/icons/credit-card';
import Image from '@lucide/svelte/icons/image';
import LayoutTemplate from '@lucide/svelte/icons/layout-template';
import Palette from '@lucide/svelte/icons/palette';
import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
import Users from '@lucide/svelte/icons/users';
import type { ConfigControl, Terminology } from '$lib/admin/businessTypes';

/**
 * The Studio's sections.
 *
 * A pure module for the same reason the rails are: `check:nav` can walk it, and
 * the shell, the change badges and the keyboard order all read one list instead
 * of three copies that drift.
 *
 * `label` is a function because a section's name belongs to the business type.
 * A hotel does not have a Menu and a grocery does not either — calling it one
 * is how a console ends up feeling like it was built for somebody else's shop.
 */
export type StudioSectionGroup = 'appearance' | 'operations';

export type StudioSectionId =
	| 'style'
	| 'branding'
	| 'homepage'
	| 'menu'
	| 'ordering'
	| 'customer'
	| 'checkout';

export type StudioSection = {
	id: StudioSectionId;
	group: StudioSectionGroup;
	label: (terms: Terminology) => string;
	hint: (terms: Terminology) => string;
	icon: Component;
	/** Categories in the change list that belong to this section. */
	categories: string[];
	/**
	 * Controls this section exists to change. A section whose every control is
	 * irrelevant to the business type is not shown at all — an empty panel is
	 * worse than a missing one. An empty list means "always relevant".
	 */
	requires?: ConfigControl[];
};

export const STUDIO_SECTIONS: StudioSection[] = [
	{
		id: 'style',
		group: 'appearance',
		label: () => 'Style',
		hint: () => 'Preset, colours, type and shape',
		icon: Palette,
		categories: ['Look']
	},
	{
		id: 'branding',
		group: 'appearance',
		label: () => 'Brand',
		hint: () => 'Name, logo and how you introduce yourself',
		icon: Image,
		categories: ['Brand', 'Contact']
	},
	{
		id: 'homepage',
		group: 'appearance',
		label: () => 'Homepage',
		hint: () => 'What a customer sees first',
		icon: LayoutTemplate,
		categories: ['Homepage']
	},
	{
		id: 'menu',
		group: 'appearance',
		label: (t) => `${t.catalog} layout`,
		hint: () => 'Layout, filters and header navigation',
		icon: UtensilsCrossed,
		categories: ['Menu layout']
	},
	{
		id: 'ordering',
		group: 'operations',
		label: () => 'Ordering & status',
		hint: () => 'Hours, pricing, and when you accept orders',
		icon: Clock,
		categories: ['Ordering', 'Hours'],
		requires: ['ordering']
	},
	{
		id: 'customer',
		group: 'operations',
		label: () => 'Customers',
		hint: () => 'Phone sign-in before checkout',
		icon: Users,
		categories: ['Customers'],
		requires: ['customer_login', 'ordering']
	},
	{
		id: 'checkout',
		group: 'operations',
		label: () => 'Payments & checkout',
		hint: () => 'Payment methods and order flow',
		icon: CreditCard,
		categories: ['Payments', 'Workflow'],
		requires: ['payment_methods', 'payment_timing', 'acceptance']
	}
];

export const STUDIO_GROUP_LABELS: Record<StudioSectionGroup, string> = {
	appearance: 'Appearance',
	operations: 'Store rules'
};

/**
 * The sections this business type has a use for.
 *
 * A type that has no payment controls has nothing to say on a Checkout panel,
 * so it does not get one.
 */
export function visibleStudioSections(controls: readonly ConfigControl[]): StudioSection[] {
	const held = new Set(controls);
	return STUDIO_SECTIONS.filter(
		(section) => !section.requires || section.requires.some((c) => held.has(c))
	);
}

export function studioSectionsByGroup(
	controls: readonly ConfigControl[]
): { group: StudioSectionGroup; label: string; sections: StudioSection[] }[] {
	const visible = visibleStudioSections(controls);
	const groups: StudioSectionGroup[] = ['appearance', 'operations'];
	return groups
		.map((group) => ({
			group,
			label: STUDIO_GROUP_LABELS[group],
			sections: visible.filter((s) => s.group === group)
		}))
		.filter((g) => g.sections.length > 0);
}

/** Map a diff category to Appearance vs Store rules for the review modal. */
export function studioGroupForCategory(category: string): StudioSectionGroup {
	if (category === 'Ordering' || category === 'Hours' || category === 'Customers') {
		return 'operations';
	}
	if (category === 'Payments' || category === 'Workflow') {
		return 'operations';
	}
	return 'appearance';
}

/** Resolve a section id to one this business type actually shows. */
export function studioSectionFor(
	requested: string | null | undefined,
	controls: readonly ConfigControl[]
): StudioSection {
	const visible = visibleStudioSections(controls);
	return visible.find((s) => s.id === requested) ?? visible[0] ?? STUDIO_SECTIONS[0];
}
