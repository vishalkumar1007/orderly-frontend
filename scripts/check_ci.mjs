#!/usr/bin/env node
/**
 * Local + CI gate for the Checks job.
 *
 * Runs the same steps GitHub Actions runs. Prints a clear PASS/FAIL summary
 * so you know whether a push will clear the Checks stage.
 *
 *   npm run check:ci
 *
 * Exit 0 = all checks passed (GitHub Checks will pass).
 * Exit 1 = at least one check failed (GitHub Checks will fail).
 */
import { spawnSync } from 'node:child_process';

// Match GitHub Actions (CI=true) so vite.config skips local-only port probing.
process.env.CI = 'true';

const steps = [
	{ name: 'Typecheck', command: 'npm', args: ['run', 'check'] },
	{ name: 'Navigation', command: 'npm', args: ['run', 'check:nav'] }
];

const results = [];

console.log('');
console.log('Running CI checks (same as GitHub Actions → Checks)…');
console.log('');

for (const step of steps) {
	console.log(`── ${step.name} ${'─'.repeat(Math.max(0, 40 - step.name.length))}`);
	const run = spawnSync(step.command, step.args, {
		stdio: 'inherit',
		env: process.env,
		shell: process.platform === 'win32'
	});
	const ok = run.status === 0;
	results.push({ name: step.name, ok });
	console.log('');
	if (!ok) {
		// Still run remaining steps so the summary shows everything that failed.
		continue;
	}
}

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok).length;
const allOk = failed === 0;

console.log('═'.repeat(48));
for (const r of results) {
	const mark = r.ok ? 'PASS' : 'FAIL';
	const icon = r.ok ? '✓' : '✗';
	console.log(`  ${icon}  ${r.name.padEnd(14)} ${mark}`);
}
console.log('─'.repeat(48));
if (allOk) {
	console.log(`  CHECKS PASSED (${passed}/${results.length}) — safe to push`);
	console.log('  GitHub Actions Checks job will pass.');
} else {
	console.log(`  CHECKS FAILED (${failed}/${results.length} failed) — fix before push`);
	console.log('  GitHub Actions Checks job will fail.');
}
console.log('═'.repeat(48));
console.log('');

process.exit(allOk ? 0 : 1);
