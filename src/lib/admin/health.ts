import type { SystemHealth } from './types';

/**
 * One reading of a health response.
 *
 * The health page, the dashboard panel and the toast that confirms a manual
 * check all have to say the same thing about the same payload. They used to
 * count the rows themselves, which is how a headline and a summary line end up
 * disagreeing about what "healthy" means.
 */
export type HealthSummary = {
	total: number;
	healthy: number;
	warning: number;
	error: number;
	unavailable: number;
	/** 'ok' | 'warn' | 'bad' | '' — drives the status dot and the toast kind. */
	tone: 'ok' | 'warn' | 'bad' | '';
	/** Short sentence for a heading or a toast. */
	headline: string;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function healthSummary(health: SystemHealth | null): HealthSummary {
	const rows = health?.components ?? [];
	const counts = {
		total: rows.length,
		healthy: rows.filter((c) => c.status === 'HEALTHY').length,
		warning: rows.filter((c) => c.status === 'WARNING').length,
		error: rows.filter((c) => c.status === 'ERROR').length,
		unavailable: rows.filter((c) => c.status === 'UNAVAILABLE').length
	};

	if (!health) {
		return { ...counts, tone: '', headline: 'Checking…' };
	}
	if (counts.error > 0) {
		return { ...counts, tone: 'bad', headline: `${plural(counts.error, 'component')} failing` };
	}
	if (counts.warning > 0) {
		return {
			...counts,
			tone: 'warn',
			headline: `${plural(counts.warning, 'component')} need${counts.warning === 1 ? 's' : ''} attention`
		};
	}
	return { ...counts, tone: 'ok', headline: 'Everything checked is healthy' };
}

/**
 * The line shown after a check the operator asked for.
 *
 * It names what the API answered rather than saying "refreshed", because the
 * whole reason to press the button is to find out whether anything changed —
 * and on a healthy platform two consecutive checks look identical on screen.
 */
export function healthCheckMessage(health: SystemHealth | null): string {
	const s = healthSummary(health);
	if (!health) return 'No response from the health check.';
	if (s.total === 0) return 'The platform reported no components to check.';
	const parts = [`${s.healthy} healthy`];
	if (s.warning > 0) parts.push(`${s.warning} needing attention`);
	if (s.error > 0) parts.push(`${s.error} failing`);
	if (s.unavailable > 0) parts.push(`${s.unavailable} not deployed`);
	return `Checked ${plural(s.total, 'component')}: ${parts.join(', ')}.`;
}
