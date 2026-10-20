import Bell from '@tabler/icons-svelte/icons/bell';
import CreditCard from '@tabler/icons-svelte/icons/credit-card';
import LayoutGrid from '@tabler/icons-svelte/icons/layout-grid';
import Mail from '@tabler/icons-svelte/icons/mail';
import Plug from '@tabler/icons-svelte/icons/plug';
import type { ShopPermission } from './nav';

/**
 * The sections inside Configuration: how the business takes payment, what it
 * tells people, and what it connects to.
 *
 * Settings is for how the business and the console behave (profile, workflow,
 * appearance, security). Configuration is for the parts that talk to the
 * outside world, which an owner sets up once and revisits rarely, so they
 * live together behind one rail entry with an overview that says what is
 * ready and what still needs doing.
 *
 * A pure module, like `settings.ts`, so `check:nav` exercises the real list.
 * Shown as tabs: five sections do not need a rail with headings. The
 * section lives in the query string (`?section=...`).
 */
export type ConfigSection = {
	id: string;
	label: string;
	icon: typeof Bell;
	/** The capability the API requires for this section's writes. */
	permission?: ShopPermission;
	lede: string;
};

export const CONFIG_SECTIONS: ConfigSection[] = [
	{
		id: 'overview',
		label: 'Overview',
		icon: LayoutGrid,
		permission: 'organization',
		lede: 'Everything your business uses to take payment, send messages and connect to other services, and what still needs setting up.'
	},
	{
		id: 'payments',
		label: 'Payments',
		icon: CreditCard,
		permission: 'organization',
		lede: 'How customers can pay at checkout, and the provider that takes online payments.'
	},
	{
		id: 'notifications',
		label: 'Notifications',
		icon: Bell,
		permission: 'organization',
		lede: 'Which events alert your team, and what customers hear as their order moves along.'
	},
	{
		id: 'email-templates',
		label: 'Email templates',
		icon: Mail,
		permission: 'organization',
		lede: 'Your logo, colour and the wording of every email your business sends. Anything you leave alone uses the standard email.'
	},
	{
		id: 'integrations',
		label: 'Integrations',
		icon: Plug,
		permission: 'integrations',
		lede: 'Email, SMS, storage and AI. Each one runs on the platform’s service until you connect your own.'
	}
];

/** Sections this account may use. An empty permission list shows everything. */
export function visibleConfigSections(permissions: readonly string[] | undefined): ConfigSection[] {
	if (!permissions || permissions.length === 0) return CONFIG_SECTIONS;
	return CONFIG_SECTIONS.filter((s) => !s.permission || permissions.includes(s.permission));
}

/** Resolve `?section=` to one this person can open, else the first they can. */
export function configSectionFor(
	requested: string | null | undefined,
	permissions: readonly string[] | undefined
): ConfigSection {
	const visible = visibleConfigSections(permissions);
	return visible.find((s) => s.id === requested) ?? visible[0] ?? CONFIG_SECTIONS[0];
}

/** A link straight to one section, for anywhere outside this screen. */
export function configHref(sectionId: string, extra = ''): string {
	return `/shop/configuration?section=${sectionId}${extra ? `&${extra}` : ''}`;
}

/** Sections that used to live in Settings, so old links can be forwarded. */
export const MOVED_FROM_SETTINGS = new Set(['notifications', 'email-templates', 'integrations']);
