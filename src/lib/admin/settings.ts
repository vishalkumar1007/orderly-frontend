import Building2 from '@tabler/icons-svelte/icons/building';
import Globe from '@tabler/icons-svelte/icons/world';
import Shapes from '@tabler/icons-svelte/icons/category';
import ShieldCheck from '@tabler/icons-svelte/icons/shield-check';
import UserRound from '@tabler/icons-svelte/icons/user';
import Palette from '@tabler/icons-svelte/icons/palette';

/**
 * The sections inside the platform console's Settings.
 *
 * A pure module for the same reason the business console's `lib/tenant/settings.ts`
 * is one: the console authenticates in the browser, so nothing in a build
 * exercises this except a check that can import it. `check:nav` walks both
 * lists, so a section naming a permission nobody holds, or two sections with
 * one id, fails there rather than as an empty pane in production.
 */
export type AdminSettingsSection = {
	id: string;
	label: string;
	icon: typeof Building2;
	group: 'Platform' | 'Your account';
	/** Permission the API requires. Sections you cannot use are not shown. */
	permission?: string;
	lede: string;
};

export const ADMIN_SETTINGS_SECTIONS: AdminSettingsSection[] = [
	{
		id: 'general',
		label: 'General',
		icon: Building2,
		group: 'Platform',
		permission: 'platform_settings',
		lede: 'How the platform identifies itself, and the defaults every new business starts from.'
	},
	{
		id: 'business-types',
		label: 'Business types',
		icon: Shapes,
		group: 'Platform',
		permission: 'platform_settings',
		lede: 'What a business can be. The type chosen at onboarding sets its theme, layout, terminology and order workflow.'
	},
	{
		id: 'security',
		label: 'Security',
		icon: ShieldCheck,
		group: 'Platform',
		permission: 'platform_settings',
		lede: 'Password rules, session lifetime and invite expiry, applied across every business.'
	},
	{
		id: 'tenant-access',
		label: 'Business access',
		icon: Globe,
		group: 'Platform',
		permission: 'platform_settings',
		lede: 'Which businesses may use the platform’s shared providers, on top of each provider’s own on/off switch. Credentials themselves live under Providers & integrations.'
	},
	{
		id: 'profile',
		label: 'Profile',
		icon: UserRound,
		group: 'Your account',
		lede: 'Your own account and password.'
	},
	{
		id: 'appearance',
		label: 'Appearance',
		icon: Palette,
		group: 'Your account',
		lede: 'How this console looks to you. Your choice follows your account and changes nothing for anyone else who signs in here: and, if you may change platform settings, what everyone starts from.'
	}
];

/** The order the rail prints its headings in. */
export const ADMIN_SETTINGS_GROUPS: Array<AdminSettingsSection['group']> = ['Platform', 'Your account'];

/**
 * The sections this account may actually use. An empty or missing permission
 * list means the session predates permissions; showing everything degrades to
 * the old behaviour, and the API still refuses what it should.
 */
export function visibleAdminSettingsSections(
	permissions: readonly string[] | undefined
): AdminSettingsSection[] {
	if (!permissions || permissions.length === 0) return ADMIN_SETTINGS_SECTIONS;
	return ADMIN_SETTINGS_SECTIONS.filter(
		(section) => !section.permission || permissions.includes(section.permission)
	);
}

/** Resolve `?section=` to a section this person can open, falling back to the first they hold. */
export function adminSettingsSectionFor(
	requested: string | null | undefined,
	permissions: readonly string[] | undefined
): AdminSettingsSection {
	const visible = visibleAdminSettingsSections(permissions);
	return visible.find((s) => s.id === requested) ?? visible[0] ?? ADMIN_SETTINGS_SECTIONS[0];
}
