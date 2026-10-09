import type { Component } from 'svelte';
import Bell from '@lucide/svelte/icons/bell';
import ListOrdered from '@lucide/svelte/icons/list-ordered';
import Palette from '@lucide/svelte/icons/palette';
import Plug from '@lucide/svelte/icons/plug';
import ShieldCheck from '@lucide/svelte/icons/shield-check';
import Store from '@lucide/svelte/icons/store';
import type { ShopPermission } from './nav';

/**
 * The sections inside Settings.
 *
 * A pure module for the same reason the rail is one: the console authenticates
 * in the browser, so nothing in a build exercises this except a check that can
 * import it. `check:nav` walks this list, which is why a section that names a
 * capability nobody holds, or two sections sharing an id, fails there rather
 * than as an empty pane in production.
 *
 * The section lives in the query string (`?section=…`) rather than in the path.
 * That keeps one destination in the rail — Settings is somewhere you go to
 * change one thing and leave — while still letting a link point at a section,
 * the back button work, and a reload stay where you were.
 */
export type SettingsSection = {
	id: string;
	label: string;
	icon: Component;
	/** Rail heading this section sits under. */
	group: 'Business' | 'You';
	/**
	 * The capability the API requires for this section's writes. A section you
	 * cannot use is not offered, exactly as with the main rail.
	 *
	 * Deliberately absent on Appearance: it changes your own screen and nobody
	 * else's, so every signed-in person gets it.
	 */
	permission?: ShopPermission;
	lede: string;
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
	{
		id: 'business',
		label: 'Business profile',
		icon: Store,
		group: 'Business',
		permission: 'organization',
		lede: 'Pickup address and phone customers see when collecting an order.'
	},
	{
		id: 'workflow',
		label: 'Order workflow',
		icon: ListOrdered,
		group: 'Business',
		permission: 'organization',
		lede: 'How an order moves from placed to collected. The stages themselves are fixed; these settings tune what happens around them.'
	},
	{
		id: 'notifications',
		label: 'Notifications',
		icon: Bell,
		group: 'Business',
		permission: 'organization',
		lede: 'What your customers hear from you as their order progresses, and where staff alerts are sent.'
	},
	{
		id: 'integrations',
		label: 'Integrations',
		icon: Plug,
		group: 'Business',
		permission: 'integrations',
		lede: 'Email, storage and AI. Each one runs on the platform’s configuration until you supply your own.'
	},
	{
		id: 'appearance',
		label: 'Appearance',
		icon: Palette,
		group: 'You',
		lede: 'How this console looks to you. Your choice follows your account and changes nothing for anyone else who works here.'
	},
	{
		id: 'security',
		label: 'Security',
		icon: ShieldCheck,
		group: 'You',
		lede: 'Two-factor authentication: the owner sets whether it is optional or required here, and everyone sets up their own methods below — nobody else can see your secrets or your codes.'
	}
];

/** The order the rail prints its headings in. */
export const SETTINGS_GROUPS: Array<SettingsSection['group']> = ['Business', 'You'];

/**
 * The sections this account may actually use.
 *
 * An empty or missing permission list means the session predates permissions;
 * showing everything degrades to the old behaviour rather than presenting an
 * empty screen, and the API still refuses anything it should.
 */
export function visibleSettingsSections(
	permissions: readonly string[] | undefined
): SettingsSection[] {
	if (!permissions || permissions.length === 0) return SETTINGS_SECTIONS;
	return SETTINGS_SECTIONS.filter(
		(section) => !section.permission || permissions.includes(section.permission)
	);
}

/**
 * Resolve `?section=` to a section this person can open.
 *
 * An unknown, missing or forbidden id falls back to the first section they do
 * hold — a stale bookmark lands somewhere useful instead of on a blank pane.
 */
export function settingsSectionFor(
	requested: string | null | undefined,
	permissions: readonly string[] | undefined
): SettingsSection {
	const visible = visibleSettingsSections(permissions);
	const match = visible.find((section) => section.id === requested);
	return match ?? visible[0] ?? SETTINGS_SECTIONS[SETTINGS_SECTIONS.length - 1];
}

/** A link straight to one section, for anywhere outside this screen. */
export function settingsHref(sectionId: string): string {
	return `/shop/settings?section=${sectionId}`;
}
