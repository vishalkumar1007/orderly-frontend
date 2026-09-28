import type { Component } from 'svelte';
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
export type StudioSectionId = 'style' | 'branding' | 'homepage' | 'menu' | 'customer' | 'checkout';

export type StudioSection = {
	id: StudioSectionId;
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
		label: () => 'Style',
		hint: () => 'Preset, colours, type and shape',
		icon: Palette,
		categories: ['Look']
	},
	{
		id: 'branding',
		label: () => 'Brand',
		hint: () => 'Name, logo and how you introduce yourself',
		icon: Image,
		categories: ['Brand', 'Contact']
	},
	{
		id: 'homepage',
		label: () => 'Homepage',
		hint: () => 'What a customer sees first',
		icon: LayoutTemplate,
		categories: ['Homepage']
	},
	{
		id: 'menu',
		label: (t) => t.catalog,
		hint: (t) => `How your ${t.items.toLowerCase()} are laid out`,
		icon: UtensilsCrossed,
		categories: []
	},
	{
		id: 'customer',
		label: () => 'Customers',
		hint: () => 'Signing in, and what you ask for',
		icon: Users,
		categories: ['Ordering'],
		requires: ['customer_login', 'ordering']
	},
	{
		id: 'checkout',
		label: () => 'Checkout',
		hint: (t) => `Paying, and how an ${t.order.toLowerCase()} is handled`,
		icon: CreditCard,
		categories: ['Payments', 'Workflow'],
		requires: ['payment_methods', 'payment_timing', 'acceptance']
	}
];

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

/** Resolve a section id to one this business type actually shows. */
export function studioSectionFor(
	requested: string | null | undefined,
	controls: readonly ConfigControl[]
): StudioSection {
	const visible = visibleStudioSections(controls);
	return visible.find((s) => s.id === requested) ?? visible[0] ?? STUDIO_SECTIONS[0];
}
