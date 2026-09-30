/**
 * Snap `font-size` declarations onto the type scale.
 *
 * Why a script and not a find-and-replace: the console had 50 distinct rem font
 * sizes in components and 41 in layout.css, most of them a fraction of a pixel
 * apart. Collapsing them by hand is 775 edits, and one missed value leaves the
 * very inconsistency this removes. Nearest-neighbour onto the scale is
 * mechanical, reviewable, and reversible.
 *
 * Scope is deliberately narrow:
 *
 *   - It rewrites `font-size` and nothing else. A font size changes a glyph, not
 *     a box, so the risk is legibility rather than layout. Padding, gap and
 *     max-width are left alone for the same reason they are left alone in the
 *     token comment in layout.css: they move boxes, and the app has no visual
 *     regression suite to catch a shifted panel.
 *   - `rem` becomes a px token, so the type scale stops moving whenever the root
 *     font size does — the coupling that let the sprawl start.
 *
 * Run: node scripts/type-scale.mjs [--check]
 */

import { globSync, readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;

/** The scale, in px, in the order planing/ui_rules.md states it. */
const TOKENS = [
	['--fs-micro', 10],
	['--fs-label', 11],
	['--fs-meta', 11.5],
	['--fs-code', 12],
	['--fs-tab', 12.5],
	['--fs-body', 13],
	['--fs-title', 16],
	['--fs-h1', 20],
	['--fs-stat', 24],
	// Above the stat size: figures that are the content rather than chrome —
	// the live order count, the countdown, the tenant-code numeral. Snapping
	// these onto `--fs-stat` would shrink a 30px number to 24px, so they get
	// their own step instead of being silently crushed.
	['--fs-display', 30]
];

/**
 * The customer-facing storefront is excluded.
 *
 * It is a different product surface with its own `--sf-*` scale and its own
 * type language — larger, more expressive, closer to a consumer app than to IDE
 * chrome. Running the dense console scale over it would shrink its hero from
 * 40px to 24px. That covers its stylesheet and the routes that render it, the
 * `(store)` group. Migrating it is its own piece of work against its own
 * reference; the two scales are bridged by token, not by codemod.
 */
const EXCLUDE = [
	/\/lib\/storefront\/(storefront|storefront-app)\.css$/,
	/\/routes\/\(store\)\//
];

/**
 * Declarations to rewrite.
 *
 * The lead group matters: `style="font-size:0.85rem"` has a quote before the
 * property and no space after the colon, and a pattern that only accepts
 * whitespace, `;`, `{` or start-of-file silently leaves every inline style in
 * the app untouched — which is how a first pass appeared to succeed while
 * missing 29 declarations.
 */
const DECLARATION = /(^|[\s;{"'])font-size:(\s*)([0-9]*\.?[0-9]+)(px|rem)/g;

const nearest = (px) => {
	let best = TOKENS[0];
	let bestDistance = Math.abs(px - best[1]);
	for (const token of TOKENS.slice(1)) {
		const distance = Math.abs(px - token[1]);
		// `<=` so a value exactly between two steps takes the larger one. The
		// scale's first job is not to make text smaller than it has to be.
		if (distance <= bestDistance) {
			best = token;
			bestDistance = distance;
		}
	}
	return best[0];
};

const check = process.argv.includes('--check');
const all = [
	...globSync(`${ROOT}src/**/*.css`),
	...globSync(`${ROOT}src/**/*.svelte`)
];
const targets = all.filter((file) => !EXCLUDE.some((pattern) => pattern.test(file)));

const report = new Map();
let changedFiles = 0;
let changedDecls = 0;

for (const file of targets) {
	const before = readFileSync(file, 'utf8');
	const after = before.replace(DECLARATION, (_match, lead, gap, rawValue, unit) => {
		const px = unit === 'rem' ? Number.parseFloat(rawValue) * 16 : Number.parseFloat(rawValue);
		const token = nearest(px);
		report.set(`${rawValue}${unit} -> ${token}`, (report.get(`${rawValue}${unit} -> ${token}`) ?? 0) + 1);
		changedDecls += 1;
		return `${lead}font-size:${gap}var(${token})`;
	});

	if (after !== before) {
		changedFiles += 1;
		if (!check) writeFileSync(file, after);
	}
}

const sorted = [...report.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
const width = Math.max(...sorted.map(([key]) => key.length));
for (const [key, count] of sorted) console.log(`  ${String(count).padStart(4)}  ${key.padEnd(width)}`);
console.log(
	`\n${changedDecls} font-size declarations across ${changedFiles} files ` +
		`(${all.length - targets.length} storefront files excluded)` +
		`${check ? ' — --check, nothing written' : ''}`
);
