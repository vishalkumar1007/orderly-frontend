/**
 * Apply the desktop cursor contract from planing/ui_rules.md.
 *
 *   "Body cursor: default. Text cursor only in inputs/editors/selectable
 *   regions." and, under anti-patterns, "cursor: pointer everywhere".
 *
 * A page that points at every row, card and button reads as a document being
 * browsed. An app that leaves the arrow alone reads as software you operate.
 * The pointer is kept only where the affordance genuinely is a pointer: drag
 * handles, resize handles, and native controls the browser marks for us.
 *
 * Line-by-line rather than by regex over selector blocks: a `[^}]*?` pattern
 * over this file crosses nested at-rules and silently matches nothing, which
 * looks like success and changes nothing.
 *
 * Run: node scripts/cursor-contract.mjs [--check]
 */

import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../src/routes/layout.css', import.meta.url).pathname;

/**
 * Selectors that stop advertising a pointer once `body` is `cursor: default`.
 *
 * These are chrome, not destinations: rail and window furniture, a close
 * button, a password reveal, a drag handle. Clicking them is incidental, and
 * pointing at all of it at once is the "web page" signal the rules call out.
 *
 * Deliberately *not* in this set, though they also disappear from a list of
 * things that could lose the pointer:
 *
 *   - `.switch`, `.check` — a toggle or checkbox is a control you aim at. They
 *     wrap a real `<input>`, so the pointer is telling the truth about a
 *     clickable target, not advertising a region.
 *   - `.menu-item`, `.tabs button`, `.steps button`, `.sfopt` — these navigate.
 *     A pointer on a destination is the one place it is load-bearing.
 */
const DROP = new Set([
	'.owner-optional',
	'.owner-optional summary',
	'.auth-eye',
	'.osrail-close',
	'.osrail-user',
	'.osrail-signout',
	'.osburger',
	'.rail-toggle',
	'.rail-user-btn',
	'.mobile-burger',
	'.sfpresets',
	'.sfpreset',
	'.sfsection-moves button',
	'.sfshift button'
]);

const check = process.argv.includes('--check');
const lines = readFileSync(FILE, 'utf8').split('\n');

let selector = '';
let removed = 0;
const out = [];

for (const line of lines) {
	const match = line.match(/^([^\s@}][^{]*?)\s*\{/);
	if (match) selector = match[1].trim();

	if (/^\s*cursor: pointer;\s*$/.test(line) && DROP.has(selector)) {
		removed += 1;
		continue;
	}
	out.push(line);
}

if (!check) writeFileSync(FILE, out.join('\n'));

const left = out.filter((line) => /cursor: pointer;/.test(line)).length;
console.log(
	`${removed} cursor:pointer declarations removed from app chrome; ${left} kept ` +
		`(drag/resize/native)${check ? ' — --check, nothing written' : ''}`
);
