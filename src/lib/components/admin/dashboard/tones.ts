/** Compact numbers for axes and tiles: 1.2K, 3.4L (en-IN), never a wall of digits. */
export const compact = (n: number): string =>
	new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
