/** Shared formatting helpers for Super Admin UI. */

export function formatDate(iso?: string | null, opts?: Intl.DateTimeFormatOptions): string {
	if (!iso) return '—';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '—';
	return d.toLocaleDateString('en-IN', opts ?? { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso?: string | null): string {
	if (!iso) return '—';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '—';
	return d.toLocaleString('en-IN', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

export function formatRelative(iso?: string | null): string {
	if (!iso) return '—';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '—';
	const diff = Date.now() - d.getTime();
	const mins = Math.round(diff / 60000);
	if (mins < 1) return 'Just now';
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.round(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.round(hours / 24);
	if (days < 30) return `${days}d ago`;
	return formatDate(iso);
}

export function formatCurrency(amount: number, currency = 'INR'): string {
	return new Intl.NumberFormat('en-IN', {
		style: 'currency',
		currency,
		maximumFractionDigits: 0
	}).format(amount);
}

export function slugify(value: string): string {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

/** Rewrite backend invite URLs (often :5173) to the current Vite port (e.g. :5174). */
export function rewriteFrontendPort(url: string): string {
	if (!url || typeof window === 'undefined' || !window.location.port) return url;
	try {
		const u = new URL(url);
		u.port = window.location.port;
		const out = u.toString();
		if (!url.endsWith('/') && out.endsWith('/') && u.pathname === '/') {
			return out.slice(0, -1);
		}
		return out;
	} catch {
		return url;
	}
}

export function joinTenantSetupUrl(tenantUrl: string, setupPath: string): string {
	const base = rewriteFrontendPort(tenantUrl).replace(/\/$/, '');
	const path = setupPath.startsWith('/') ? setupPath : `/${setupPath}`;
	return `${base}${path}`;
}

/** Up to two uppercase initials for avatar chips. */
export function initials(name?: string | null, fallback = '?'): string {
	const src = (name ?? '').trim();
	if (!src) return fallback;
	const parts = src.split(/[\s._-]+/).filter(Boolean);
	if (parts.length === 0) return fallback;
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Parse a numeric string from the API (revenue totals arrive as strings). */
export function toNumber(raw: string | number | null | undefined): number {
	if (raw === null || raw === undefined || raw === '') return 0;
	const n = typeof raw === 'number' ? raw : Number.parseFloat(raw);
	return Number.isFinite(n) ? n : 0;
}

/** Grouped rupee amount, e.g. 18450 → "₹18,450". */
export function rupees(raw: string | number | null | undefined): string {
	const n = toNumber(raw);
	if (!n) return '₹0';
	return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/** Human label for a business type code. */
export function businessTypeLabel(code?: string | null): string {
	if (!code) return '—';
	return code.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
}
