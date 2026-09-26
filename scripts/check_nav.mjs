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
	const sf = await vite.ssrLoadModule('/src/lib/storefront/admin-nav.ts');

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

	if (!nav.TENANT_NAV.some((g) => g.items.some((i) => i.href === '/shop/storefront'))) {
		failures++;
		console.log('  FAIL /shop/storefront is not in the tenant rail, so it can only be reached by typing the URL');
	} else {
		ok('tenant rail links the storefront control');
	}

	/* ---------------------------------------------------------------- */
	group('Titles');

	eq('/shop', nav.tenantTitle('/shop'), 'Dashboard');
	eq('/shop/orders', nav.tenantTitle('/shop/orders'), 'Orders');
	eq('/shop/settings/smtp', nav.tenantTitle('/shop/settings/smtp'), 'Email / SMTP');
	eq('/kitchen', nav.tenantTitle('/kitchen'), 'Kitchen board');
	eq('/shop/storefront', nav.tenantTitle('/shop/storefront'), 'Storefront');

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
		nav.tenantCrumbs('/shop/storefront/theme'),
		[
			{ label: 'Overview', href: '/shop' },
			{ label: 'Storefront', href: '/shop/storefront' },
			{ label: 'Theme', href: null }
		]
	);

	eq('a path that is not a shop route has no trail', nav.tenantCrumbs('/menu'), []);

	// `settings` groups a section with no page of its own, so it must not offer a
	// dead link.
	eq(
		'a grouping segment reuses the previous target',
		nav.tenantCrumbs('/shop/settings/ai'),
		[
			{ label: 'Overview', href: '/shop' },
			{ label: 'Settings', href: '/shop' },
			{ label: 'AI', href: null }
		]
	);

	for (const item of sf.STOREFRONT_NAV) {
		const crumbs = nav.tenantCrumbs(item.href);
		const last = crumbs[crumbs.length - 1];
		eq(`trail for ${item.href} ends on the screen`, last, {
			label: item.href === '/shop/storefront' ? 'Storefront' : item.label,
			href: null
		});
	}

	/* ---------------------------------------------------------------- */
	group('Storefront nav: every screen titles and lights itself, and only itself');

	for (const item of sf.STOREFRONT_NAV) {
		eq(`title ${item.href}`, nav.tenantTitle(item.href), item.href === '/shop/storefront' ? 'Storefront' : item.label);

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
	if (sf.isStorefrontActive('/shop/storefront/theme/warm', sf.STOREFRONT_NAV[2])) {
		ok('a screen stays lit on a sub-path');
	} else {
		failures++;
		console.log('  FAIL a screen does not stay lit on a sub-path');
	}

	/* ---------------------------------------------------------------- */
	group('Staff-facing nav is unaffected');

	// ShopShell (the kitchen) uses SHOP_NAV. The storefront control is owner-only,
	// so it must not have leaked into the staff rail.
	if (itemsOf(nav.SHOP_NAV).some((i) => i.href.startsWith('/shop/storefront'))) {
		failures++;
		console.log('  FAIL the staff rail offers the owner-only storefront control');
	} else {
		ok('the staff rail does not offer the storefront control');
	}
} finally {
	await vite.close();
}

console.log(
	`\n${failures === 0 ? `all ${checks} nav checks passed` : `${failures} of ${checks} nav checks FAILED`}`
);
process.exit(failures === 0 ? 0 : 1);
