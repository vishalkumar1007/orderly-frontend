/**
 * Navigation and breadcrumb checks.
 *
 * The console's left rail, its breadcrumb trail and its page title are all
 * derived from a route string by pure functions in `lib/tenant/nav.ts` and
 * `lib/storefront/admin-nav.ts`. Nothing else in the build exercises them: the
 * admin routes authenticate in the browser, so a server render cannot tell a
 * correct title from a wrong one, and a title is exactly the kind of thing that
 * rots quietly.
 *
 * It runs the real modules through Vite's SSR loader rather than a copy, because
 * the bugs worth catching here are disagreements *between* the call sites — a
 * duplicated table would agree with itself forever.
 *
 *   node scripts/check_nav.mjs
 *
 * Exits non-zero on the first failed expectation count, so it is usable in CI.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const routesDir = join(root, 'src/routes');

let failures = 0;
let checks = 0;

function ok(label, value) {
	checks++;
	console.log(`  ok   ${label}${value === undefined ? '' : ` = ${JSON.stringify(value)}`}`);
}

function eq(label, got, want) {
	checks++;
	const g = JSON.stringify(got);
	const w = JSON.stringify(want);
	if (g === w) {
		console.log(`  ok   ${label} = ${g}`);
		return;
	}
	failures++;
	console.log(`  FAIL ${label}\n         got  ${g}\n         want ${w}`);
}

function group(title) {
	console.log(`\n${title}`);
}

/**
 * Does `path` resolve to a real page?
 *
 * A SvelteKit route group — `(store)` — is invisible in the URL, so a path may
 * have an extra directory level that the caller never typed. Try the literal
 * path first, then drop one group segment at a time, which is enough for the
 * nesting this app actually uses.
 */
function hasPage(path) {
	const literal = path === '/' ? '' : path;
	const segs = literal.split('/').filter(Boolean);
	const strip = (i) => segs.filter((_, j) => j !== i && !segs[j].startsWith('('));

	const candidates = [segs];
	for (let i = 0; i < segs.length; i++) candidates.push(strip(i));

	for (const seg of candidates) {
		const dir = join(routesDir, ...seg);
		for (const page of ['+page.svelte', '+page.server.ts', '+layout.svelte']) {
			if (existsSync(join(dir, page))) return true;
		}
	}
	return false;
}

const vite = await createServer({
	configFile: join(root, 'vite.config.ts'),
	server: { middlewareMode: true, hmr: false },
	appType: 'custom',
	logLevel: 'error'
});

/** A nav export is either a flat item list or a list of `{ items }` groups. */
const itemsOf = (nav) =>
	nav.flatMap((entry) => (Array.isArray(entry.items) ? entry.items : [entry]));

try {
	const nav = await vite.ssrLoadModule('/src/lib/tenant/nav.ts');
	const tenantSettings = await vite.ssrLoadModule('/src/lib/tenant/settings.ts');
	const consoleTheme = await vite.ssrLoadModule('/src/lib/admin/consoleTheme.ts');
	const studio = await vite.ssrLoadModule('/src/lib/storefront/studioSections.ts');
	const sf = await vite.ssrLoadModule('/src/lib/storefront/admin-nav.ts');
	const sa = await vite.ssrLoadModule('/src/lib/admin/nav.ts');
	const types = await vite.ssrLoadModule('/src/lib/admin/businessTypes.ts');

	/* ---------------------------------------------------------------- */
	group('Every navigation entry points at a real page');

	const navs = [
		['SHOP_NAV', itemsOf(nav.SHOP_NAV)],
		['SHOP_TABS', itemsOf(nav.SHOP_TABS)],
		['TENANT_NAV', itemsOf(nav.TENANT_NAV)],
		['STOREFRONT_NAV', itemsOf(sf.STOREFRONT_NAV)]
	];
	const hrefs = [];
	for (const [name, items] of navs) {
		for (const item of items) {
			hrefs.push([name, item.href]);
			// `/` is the storefront, reached on a tenant host rather than by path.
			if (item.href === '/') continue;
			if (!hasPage(item.href)) {
				failures++;
				console.log(`  FAIL ${name} entry ${item.href} has no page under src/routes`);
			}
		}
	}
	checks += hrefs.length;

	// Scoped to a single nav on purpose. SHOP_NAV and TENANT_NAV overlap by
	// design — the same destination is reachable from the staff shell and the
	// owner shell — so a duplicate *across* them is the design working, not a
	// mistake. A duplicate within one nav means two lit entries at once.
	for (const [name, items] of navs) {
		const seen = new Set();
		const dupes = [];
		for (const item of items) {
			if (seen.has(item.href)) dupes.push(item.href);
			seen.add(item.href);
		}
		eq(`${name} has no duplicate href`, dupes, []);
	}

	/* ---------------------------------------------------------------- */
	group('The storefront control is reachable and owner-only');

	if (!nav.TENANT_NAV.some((g) => g.items.some((i) => i.href === '/shop/customize'))) {
		failures++;
		console.log('  FAIL /shop/customize is not in the tenant rail, so it can only be reached by typing the URL');
	} else {
		ok('tenant rail links the storefront control (Customize)');
	}

	/* ---------------------------------------------------------------- */
	group('Titles');

	eq('/shop', nav.tenantTitle('/shop'), 'Dashboard');
	eq('/shop/orders', nav.tenantTitle('/shop/orders'), 'Selling');
	eq('/shop/settings', nav.tenantTitle('/shop/settings'), 'Settings');
	eq('/shop/kitchen', nav.tenantTitle('/shop/kitchen'), 'Kitchen');
	eq('/shop/live', nav.tenantTitle('/shop/live'), 'Live Activity');
	eq('/shop/customize', nav.tenantTitle('/shop/customize'), 'Customize');
	eq('/shop/storefront/hours', nav.tenantTitle('/shop/storefront/hours'), 'Operating Hours');
	eq('/shop/payments', nav.tenantTitle('/shop/payments'), 'Payments');
	eq('/shop/setup', nav.tenantTitle('/shop/setup'), 'Launch checklist');
	eq('/shop/customers', nav.tenantTitle('/shop/customers'), 'Customers');
	eq('/shop/iam', nav.tenantTitle('/shop/iam'), 'IAM');

	// The ambiguity that motivated the storefront owning its own labels: the same
	// segment means two different things depending on its parent.
	eq('/shop/login (staff sign-in)', nav.tenantTitle('/shop/login'), 'Login');
	eq(
		'/shop/storefront/login (customer setting)',
		nav.tenantTitle('/shop/storefront/login'),
		'Customer login'
	);

	/* ---------------------------------------------------------------- */
	group('Breadcrumbs');

	eq(
		'a storefront trail links every crumb but the last',
		nav.tenantCrumbs('/shop/customize/theme'),
		[
			{ label: 'Overview', href: '/shop' },
			{ label: 'Customize', href: '/shop/customize' },
			{ label: 'Theme', href: null }
		]
	);

	eq('a path that is not a shop route has no trail', nav.tenantCrumbs('/menu'), []);

	// Settings is one destination. Its sections live in the query string, so a
	// section never adds a crumb — the trail stops at Settings.
	eq(
		'settings trail',
		nav.tenantCrumbs('/shop/settings'),
		[
			{ label: 'Overview', href: '/shop' },
			{ label: 'Settings', href: null }
		]
	);

	eq(
		'kitchen trail under the org shell',
		nav.tenantCrumbs('/shop/kitchen'),
		[
			{ label: 'Overview', href: '/shop' },
			{ label: 'Kitchen', href: null }
		]
	);

	// Opening hours sit under the storefront, beside Preview and QR.
	eq(
		'opening hours trail',
		nav.tenantCrumbs('/shop/storefront/hours'),
		[
			{ label: 'Overview', href: '/shop' },
			{ label: 'Storefront', href: '/shop/storefront' },
			{ label: 'Operating Hours', href: null }
		]
	);

	eq(
		'payments trail',
		nav.tenantCrumbs('/shop/payments'),
		[
			{ label: 'Overview', href: '/shop' },
			{ label: 'Payments', href: null }
		]
	);

	for (const item of sf.STOREFRONT_NAV) {
		const crumbs = nav.tenantCrumbs(item.href);
		const last = crumbs[crumbs.length - 1];
		eq(`trail for ${item.href} ends on the screen`, last, {
			label: item.href === '/shop/customize' ? 'Customize' : item.label,
			href: null
		});
	}

	/* ---------------------------------------------------------------- */
	group('The tenant rail is about running a shop, not configuring one');

	eq(
		'rail sections',
		nav.TENANT_NAV.map((g) => g.label),
		['Overview', 'Running', 'Management', 'Storefront', 'Organization', 'Activity']
	);

	// The point of the reorganisation: Organization offers three destinations,
	// not the eight it accumulated. Everything else became a Settings section,
	// and a rail entry creeping back is exactly what this catches.
	{
		const org = nav.TENANT_NAV.find((g) => g.label === 'Organization');
		eq(
			'Organization destinations',
			org?.items.map((i) => i.label),
			['Payments', 'IAM', 'Settings']
		);

		const storefront = nav.TENANT_NAV.find((g) => g.label === 'Storefront');
		eq(
			'Storefront destinations',
			storefront?.items.map((i) => i.label),
			['Customize', 'Operating Hours', 'Preview', 'QR & Share']
		);
	}

	// One lit entry per destination, as on the platform rail.
	{
		const items = itemsOf(nav.TENANT_NAV);
		for (const item of items) {
			const lit = items.filter((other) => nav.isActive(item.href, other));
			if (lit.length === 1 && lit[0].href === item.href) {
				ok(`${item.href} lights exactly itself`);
			} else {
				failures++;
				console.log(`  FAIL ${item.href} lights ${lit.map((a) => a.href).join(', ') || 'nothing'}`);
			}
		}
	}

	/* ---------------------------------------------------------------- */
	group('Settings sections');

	{
		const ids = tenantSettings.SETTINGS_SECTIONS.map((s) => s.id);
		eq('section ids', ids, ['business', 'workflow', 'notifications', 'integrations', 'appearance']);
		eq('no duplicate section id', ids.length, new Set(ids).size);

		// Every section names a capability the API actually grants, or none at
		// all. A typo here would hide a screen from the owner with no error.
		const known = new Set([
			'selling', 'kitchen', 'live_activity', 'menu', 'customers', 'staff',
			'storefront', 'organization', 'integrations', 'iam', 'settings',
			'analytics', 'activity'
		]);
		const unknown = tenantSettings.SETTINGS_SECTIONS
			.map((s) => s.permission)
			.filter((p) => p && !known.has(p));
		eq('every section names a real capability', unknown, []);

		// Appearance is the one section with no capability: it changes your own
		// screen, so a member of staff must be able to reach it.
		const staffSections = tenantSettings
			.visibleSettingsSections(['selling', 'kitchen'])
			.map((s) => s.id);
		eq('what staff can open', staffSections, ['appearance']);

		const ownerSections = tenantSettings
			.visibleSettingsSections(['organization', 'integrations', 'settings', 'storefront'])
			.map((s) => s.id);
		eq('what an owner can open', ownerSections, ids);

		// A stale bookmark must land somewhere real rather than on a blank pane.
		eq(
			'an unknown section falls back',
			tenantSettings.settingsSectionFor('does-not-exist', ['organization']).id,
			'business'
		);
		eq(
			'a section this role cannot open falls back',
			tenantSettings.settingsSectionFor('integrations', ['selling', 'kitchen']).id,
			'appearance'
		);
		eq(
			'a section link points at the settings screen',
			tenantSettings.settingsHref('workflow'),
			'/shop/settings?section=workflow'
		);
	}

	/* ---------------------------------------------------------------- */
	group('Onboarding seeds the business console from the look it was given');

	{
		// A trimmed stand-in for /admin/theme-presets.
		const presets = [
			{ id: 'indigo-violet', name: 'Indigo', tokens: { accent: '#4f46e5', accent2: '#6366f1' } },
			{ id: 'emerald', name: 'Emerald', tokens: { accent: '#059669', accent2: '#10b981' } },
			{ id: 'orange', name: 'Orange', tokens: { accent: '#ea580c', accent2: '#f97316' } }
		];

		eq(
			'a green storefront maps onto the green console preset',
			consoleTheme.nearestPreset('#0d9488', presets)?.id,
			'emerald'
		);
		eq(
			'a warm storefront maps onto the warm console preset',
			consoleTheme.nearestPreset('#b91c1c', presets)?.id,
			'orange'
		);

		const seed = consoleTheme.consoleThemeSeed(
			{ primary: '#ea580c', secondary: '#b91c1c', mode: 'light' },
			presets
		);
		eq('the seed names a real preset', seed?.theme_preset_id, 'orange');
		eq('the seed carries the chosen colours verbatim', seed?.theme_overrides, {
			accent: '#ea580c',
			accent2: '#b91c1c'
		});
		eq('a dark storefront opens a dark console', consoleTheme.consoleThemeSeed(
			{ primary: '#f97316', secondary: '#fb923c', mode: 'dark' }, presets
		)?.theme_color_mode, 'dark');

		// With no catalogue there is no valid preset id to send, and inventing
		// one would have the API reject the whole business.
		eq(
			'no catalogue means no theme fields rather than an invalid one',
			consoleTheme.consoleThemeSeed({ primary: '#ea580c', secondary: '', mode: 'light' }, []),
			null
		);
	}

	/* ---------------------------------------------------------------- */
	group('The Studio speaks the business type\'s language');

	{
		const ids = studio.STUDIO_SECTIONS.map((s) => s.id);
		eq('section ids', ids, ['style', 'branding', 'homepage', 'menu', 'customer', 'checkout']);
		eq('no duplicate section id', ids.length, new Set(ids).size);

		// The catalogue section is named by the type, not by the developer. A
		// hotel does not have a "Menu", and this is the check that says so.
		const food = types.templateFor('FOOD_SHOP');
		const grocery = types.templateFor('GROCERY');
		const catalogue = studio.STUDIO_SECTIONS.find((s) => s.id === 'menu');
		eq('a food shop calls it', catalogue.label(food.terminology), food.terminology.catalog);
		eq('a grocery calls it', catalogue.label(grocery.terminology), grocery.terminology.catalog);

		// Every section's change categories must be ones the diff can produce,
		// or a badge would never light and nobody would notice.
		const known = new Set(['Brand', 'Contact', 'Look', 'Ordering', 'Payments', 'Workflow', 'Homepage']);
		const unknown = studio.STUDIO_SECTIONS
			.flatMap((s) => s.categories)
			.filter((c) => !known.has(c));
		eq('every section maps to real change categories', unknown, []);

		// A type with no payment controls has nothing to say on a Checkout
		// panel, so it does not get one.
		const withoutPayments = studio.visibleStudioSections(['ordering', 'prep_time']).map((s) => s.id);
		eq('a type with no payment controls has no Checkout', withoutPayments.includes('checkout'), false);
		eq('and still has the look sections', withoutPayments.includes('style'), true);

		const owner = studio.visibleStudioSections(food.controls).map((s) => s.id);
		eq('a food shop sees every section', owner, ids);

		eq(
			'an unknown section falls back to the first one this type shows',
			studio.studioSectionFor('nope', ['ordering']).id,
			'style'
		);
	}

	/* ---------------------------------------------------------------- */
	group('Super Admin rail: sections, destinations and exclusivity');

	const saItems = sa.navItems();

	eq(
		'rail sections',
		sa.SUPERADMIN_NAV.map((g) => g.label),
		['Overview', 'Businesses', 'Platform', 'Monitoring', 'Settings']
	);

	for (const item of saItems) {
		checks++;
		if (!hasPage(item.href)) {
			failures++;
			console.log(`  FAIL Super Admin entry ${item.href} has no page under src/routes`);
		}
	}

	{
		const seen = new Set();
		const dupes = [];
		for (const item of saItems) {
			if (seen.has(item.href)) dupes.push(item.href);
			seen.add(item.href);
		}
		eq('SUPERADMIN_NAV has no duplicate href', dupes, []);
	}

	// One lit entry per destination. The pairs that overlap by path — the
	// dashboard against everything, the business list against onboarding,
	// general settings against its siblings — are exactly the ones an `exact`
	// or `exclude` rule exists for, so this is the check that proves the rules
	// are still doing their job.
	for (const item of saItems) {
		const lit = saItems.filter((other) => sa.isAdminNavActive(item.href, other));
		if (lit.length === 1 && lit[0].href === item.href) {
			ok(`${item.href} lights exactly itself`);
		} else {
			failures++;
			console.log(`  FAIL ${item.href} lights ${lit.map((a) => a.href).join(', ') || 'nothing'}`);
		}
	}

	// A detail page keeps its section lit.
	if (sa.isAdminNavActive('/superadmin/businesses/abc123', saItems.find((i) => i.href === '/superadmin/businesses'))) {
		ok('a business detail page keeps All businesses lit');
	} else {
		failures++;
		console.log('  FAIL a business detail page does not light All businesses');
	}

	/* ---------------------------------------------------------------- */
	group('Super Admin titles and trails');

	eq('/superadmin', sa.adminTitle('/superadmin'), 'Dashboard');
	eq('/superadmin/businesses', sa.adminTitle('/superadmin/businesses'), 'All businesses');
	eq('/superadmin/businesses/new', sa.adminTitle('/superadmin/businesses/new'), 'Onboard a business');
	eq('/superadmin/plans', sa.adminTitle('/superadmin/plans'), 'Plans & subscriptions');
	eq('/superadmin/iam', sa.adminTitle('/superadmin/iam'), 'Users & IAM');
	eq('/superadmin/providers', sa.adminTitle('/superadmin/providers'), 'Providers & integrations');
	eq('/superadmin/activity', sa.adminTitle('/superadmin/activity'), 'Activity & audit');
	eq('/superadmin/health', sa.adminTitle('/superadmin/health'), 'System health');
	eq('/superadmin/settings', sa.adminTitle('/superadmin/settings'), 'Settings');

	// Every settings screen has exactly one home. The section used to repeat
	// General, Branding and Security in a second column beside the rail, which
	// meant two active states for one destination; these assert the rail is now
	// the only list, and that the account screen is deliberately outside it.
	{
		const settingsGroup = sa.SUPERADMIN_NAV.find((g) => g.label === 'Settings');
		const monitoring = sa.SUPERADMIN_NAV.find((g) => g.label === 'Monitoring');
		eq(
			'Monitoring destinations',
			monitoring?.items.map((i) => i.label),
			['Activity & audit', 'System health']
		);

		// One destination. Its sections live inside the page, reached by a
		// query string, so the rail never repeats them.
		eq(
			'Settings group destinations',
			settingsGroup?.items.map((i) => i.label),
			['Settings']
		);

		const railHrefs = new Set(sa.navItems().map((i) => i.href));
		if (railHrefs.has('/superadmin/settings/profile')) {
			failures++;
			console.log('  FAIL the account screen is in the rail as well as the account menu');
		} else {
			ok('the account screen lives only in the account menu');
		}

		eq(
			'account menu links',
			sa.ACCOUNT_LINKS.map((l) => l.href),
			['/superadmin/settings?section=profile']
		);

		for (const link of sa.ACCOUNT_LINKS) {
			checks++;
			if (!hasPage(link.href.split('?')[0])) {
				failures++;
				console.log(`  FAIL account link ${link.href} has no page under src/routes`);
			}
		}
	}

	// A business id resolves to its name when the shell has loaded the list,
	// and degrades to a generic label when it has not.
	eq(
		'a business detail title uses the loaded name',
		sa.adminTitle('/superadmin/businesses/b-1', { businesses: [{ id: 'b-1', name: 'Momo Magic' }] }),
		'Momo Magic'
	);
	eq(
		'an unknown business still titles the page',
		sa.adminTitle('/superadmin/businesses/b-1'),
		'Business'
	);

	eq(
		'a business trail names the business and its tab',
		sa.adminCrumbs('/superadmin/businesses/b-1', {
			businesses: [{ id: 'b-1', name: 'Momo Magic' }],
			tab: 'subscription'
		}),
		[
			{ label: 'Super Admin', href: '/superadmin' },
			{ label: 'Businesses', href: '/superadmin/businesses' },
			{ label: 'Momo Magic', href: '/superadmin/businesses/b-1' },
			{ label: 'Subscription', href: null }
		]
	);

	eq('a path outside the console has no trail', sa.adminCrumbs('/shop/orders'), []);

	/* ---------------------------------------------------------------- */
	group('Business types: every shape resolves to a usable template');

	// The catalogue is data, so a code with no template must still produce one.
	// This is the guarantee that lets an operator add a type without a release.
	for (const code of ['FOOD_SHOP', 'GROCERY', 'CAFE', 'RESTAURANT', 'HOTEL']) {
		const tpl = types.templateFor(code);
		eq(`${code} has its own template`, tpl.code, code);
	}

	{
		const unknown = types.templateFor('PHARMACY');
		eq('an unknown code falls back without throwing', unknown.code, 'PHARMACY');
		eq('the fallback still configures a storefront', typeof unknown.storefront.theme_preset, 'string');
		eq('the fallback still names its catalogue', typeof unknown.terminology.catalog, 'string');
	}

	{
		// Legacy cuisine codes are the reason aliases exist: businesses created
		// before the catalogue changed must keep rendering.
		const momo = types.templateFor('MOMO');
		eq('MOMO resolves to the food-shop shape', momo.storefront.theme_preset, 'street-food');
		eq('MOMO keeps its own code', momo.code, 'MOMO');
	}

	{
		const offered = types.onboardingTypes([
			{ code: 'GROCERY', label: 'Grocery', active: true, sort_order: 20 },
			{ code: 'FOOD_SHOP', label: 'Street food', active: true, sort_order: 10 },
			{ code: 'TEA', label: 'Tea', active: false, sort_order: 90 }
		]);
		eq(
			'onboarding offers active types in catalogue order',
			offered.map((t) => t.code),
			['FOOD_SHOP', 'GROCERY']
		);
		eq(
			"the operator's own label wins over the built-in one",
			offered[0].label,
			'Street food'
		);
	}

	eq(
		'an empty catalogue still offers the built-in shapes',
		types.onboardingTypes([]).length > 0,
		true
	);

	/* ---------------------------------------------------------------- */
	group('Storefront nav: every screen titles and lights itself, and only itself');

	for (const item of sf.STOREFRONT_NAV) {
		eq(
			`title ${item.href}`,
			nav.tenantTitle(item.href),
			item.href === '/shop/customize' ? 'Customize' : item.label
		);

		const lit = sf.STOREFRONT_NAV.filter((o) => sf.isStorefrontActive(item.href, o));
		if (lit.length === 1 && lit[0] === item) {
			ok(`${item.href} lights exactly itself`);
		} else {
			failures++;
			console.log(
				`  FAIL ${item.href} lights ${lit.map((a) => a.href).join(', ') || 'nothing'}`
			);
		}
	}

	// A screen must stay lit while a sub-tab under it is open, or the rail looks
	// broken the moment a screen grows one.
	if (sf.isStorefrontActive('/shop/customize/theme/warm', sf.STOREFRONT_NAV[2])) {
		ok('a screen stays lit on a sub-path');
	} else {
		failures++;
		console.log('  FAIL a screen does not stay lit on a sub-path');
	}

	/* ---------------------------------------------------------------- */
	group('Org rail IA sections');

	const labels = nav.TENANT_NAV.map((g) => g.label);
	eq('org rail section labels', labels, [
		'Overview',
		'Running',
		'Management',
		'Storefront',
		'Organization',
		'Activity'
	]);

	const running = nav.TENANT_NAV.find((g) => g.label === 'Running');
	eq('Running is emphasized', running?.emphasis, 'running');
	eq(
		'Running destinations',
		running?.items.map((i) => i.label),
		['Selling', 'Kitchen', 'Live Activity']
	);

	/* ---------------------------------------------------------------- */
	/* ---------------------------------------------------------------- */
	group('The business type shapes the console');

	// Every permission a business owner has, so these checks exercise the type
	// filter rather than accidentally testing the permission filter.
	const OWNER_PERMS = [
		'selling', 'kitchen', 'live_activity', 'menu', 'customers', 'staff',
		'storefront', 'organization', 'integrations', 'iam', 'settings',
		'analytics', 'activity'
	];

	const TYPES = ['FOOD', 'CAFE', 'RESTAURANT', 'GROCERY', 'HOTEL'];

	const railFor = (code) =>
		itemsOf(nav.visibleGroups(nav.TENANT_NAV, OWNER_PERMS, 'TENANT_ADMIN', code));

	// 1. Every type's rail still points only at pages that exist. Relabelling
	//    must never change an href.
	for (const code of TYPES) {
		const bad = railFor(code).filter((i) => i.href !== '/' && !hasPage(i.href));
		if (bad.length > 0) {
			failures++;
			console.log(`  FAIL ${code} rail points at missing pages: ${bad.map((i) => i.href).join(', ')}`);
		} else {
			ok(`${code} rail resolves to real pages`, railFor(code).length);
		}
	}

	// 2. The point of the whole feature: two different types must not produce
	//    the same rail. If this passes trivially, the type is decorative again.
	const signature = (code) => railFor(code).map((i) => `${i.href}:${i.label}`).join('|');
	for (const [a, b] of [['CAFE', 'GROCERY'], ['CAFE', 'HOTEL'], ['GROCERY', 'HOTEL']]) {
		if (signature(a) === signature(b)) {
			failures++;
			console.log(`  FAIL ${a} and ${b} produce an identical rail — the business type does nothing`);
		} else {
			ok(`${a} and ${b} rails differ`);
		}
	}

	// 3. The station is named for the work done there.
	eq('cafe calls the board the Bar', nav.labelFor({ label: 'Kitchen', term: 'station' }, 'CAFE'), 'Bar');
	eq('grocery calls the board Packing', nav.labelFor({ label: 'Kitchen', term: 'station' }, 'GROCERY'), 'Packing');
	eq('hotel calls the board the Service desk', nav.labelFor({ label: 'Kitchen', term: 'station' }, 'HOTEL'), 'Service desk');
	eq('food shop keeps Kitchen', nav.labelFor({ label: 'Kitchen', term: 'station' }, 'FOOD'), 'Kitchen');

	// 4. The catalogue is named for what it holds.
	eq('grocery has a Catalogue, not a Menu', nav.labelFor({ label: 'Menu', term: 'catalog' }, 'GROCERY'), 'Catalogue');
	eq('hotel has a Service list', nav.labelFor({ label: 'Menu', term: 'catalog' }, 'HOTEL'), 'Service list');

	// 5. Page titles and breadcrumbs follow the same vocabulary, or the rail
	//    says Packing and the page it opens still says Kitchen.
	eq('grocery kitchen title', nav.tenantTitle('/shop/kitchen', 'GROCERY'), 'Packing');
	eq('hotel menu title', nav.tenantTitle('/shop/menu', 'HOTEL'), 'Service list');
	eq('cafe staff title', nav.tenantTitle('/shop/staff', 'CAFE'), 'Baristas');
	eq(
		'grocery breadcrumb for the board',
		nav.tenantCrumbs('/shop/kitchen', 'GROCERY').map((c) => c.label),
		['Overview', 'Packing']
	);

	// 6. A type only hides something meaningless for it, and the pickup board
	//    is the one case: nobody queues at a counter in a hotel.
	for (const code of ['GROCERY', 'HOTEL']) {
		if (railFor(code).some((i) => i.href === '/shop/live')) {
			failures++;
			console.log(`  FAIL ${code} still offers the pickup display`);
		} else {
			ok(`${code} does not offer the pickup display`);
		}
	}
	for (const code of ['FOOD', 'CAFE', 'RESTAURANT']) {
		if (!railFor(code).some((i) => i.href === '/shop/live')) {
			failures++;
			console.log(`  FAIL ${code} lost the pickup display`);
		} else {
			ok(`${code} offers the pickup display`);
		}
	}

	// 7. Hiding is the exception. Nothing else may vanish, so every other
	//    destination an owner can reach survives every type.
	const baseline = railFor('FOOD').map((i) => i.href).filter((h) => h !== '/shop/live');
	for (const code of TYPES) {
		const got = railFor(code).map((i) => i.href);
		const lost = baseline.filter((h) => !got.includes(h));
		if (lost.length > 0) {
			failures++;
			console.log(`  FAIL ${code} silently dropped: ${lost.join(', ')}`);
		} else {
			ok(`${code} keeps every non-optional destination`);
		}
	}

	// 8. An unknown type — a row added to the catalogue with no template yet —
	//    must still produce a working rail rather than an empty one.
	const unknown = railFor('TAILOR');
	if (unknown.length === 0) {
		failures++;
		console.log('  FAIL an unknown business type produces an empty rail');
	} else {
		ok('an unknown business type falls back to a full rail', unknown.length);
	}

	// 9. Every type's dashboard shortcuts point at real pages.
	for (const code of [...TYPES, 'TAILOR']) {
		const actions = types.quickActionsFor(code);
		const bad = actions.filter((a) => !hasPage(a.href.split('?')[0]));
		if (bad.length === 0 && actions.length > 0) {
			ok(`${code} quick actions resolve`, actions.length);
		} else {
			failures++;
			console.log(`  FAIL ${code} quick actions broken: ${JSON.stringify(bad)}`);
		}
	}

	group('Staff-facing nav is unaffected');

	// SHOP_NAV is the legacy staff list. The storefront control is owner-only,
	// so it must not have leaked into that rail.
	if (itemsOf(nav.SHOP_NAV).some((i) => i.href.startsWith('/shop/storefront'))) {
		failures++;
		console.log('  FAIL the staff rail offers the owner-only storefront control');
	} else {
		ok('the staff rail does not offer the storefront control');
	}

	if (!itemsOf(nav.TENANT_NAV).some((i) => i.href === '/shop/kitchen')) {
		failures++;
		console.log('  FAIL Kitchen is missing from the org rail');
	} else {
		ok('org rail links Kitchen under /shop/kitchen');
	}

	if (!nav.TENANT_NAV.some((g) => g.label === 'Organization')) {
		failures++;
		console.log('  FAIL Organization group is missing from the org rail');
	} else {
		ok('org rail has a distinct Organization group');
	}

	if (!nav.isOpsFullscreenPath('/shop/kitchen') || !nav.isOpsFullscreenPath('/shop/live')) {
		failures++;
		console.log('  FAIL Kitchen/Live Activity are not recognized as fullscreen ops paths');
	} else {
		ok('Kitchen and Live Activity support fullscreen ops mode');
	}
} finally {
	await vite.close();
}

console.log(
	`\n${failures === 0 ? `all ${checks} nav checks passed` : `${failures} of ${checks} nav checks FAILED`}`
);
process.exit(failures === 0 ? 0 : 1);
