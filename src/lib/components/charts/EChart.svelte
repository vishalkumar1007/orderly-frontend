<script lang="ts" module>
	/** Console colours read from CSS, so charts follow the theme and the brand. */
	export type ChartTokens = {
		text: string;
		text2: string;
		text3: string;
		border: string;
		grid: string;
		surface: string;
		surface2: string;
		/** The panel colour charts sit on, for tooltips and heatmap gaps. */
		card: string;
		accent: string;
		accent2: string;
		success: string;
		warn: string;
		danger: string;
		font: string;
		/** True for the console's dark surfaces, so series can carry more weight. */
		dark: boolean;
	};

	/** One shared probe that turns color-mix() and other CSS colours into rgb(). */
	let colourProbe: HTMLSpanElement | null = null;

	/** The RGB channels of a hex, rgb() or color(srgb) value. */
	function channels(colour: string): [number, number, number] | null {
		const c = colour.trim();
		const rgb = c.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
		if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
		const srgb = c.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
		if (srgb) return srgb.slice(1, 4).map((v) => Math.round(Number(v) * 255)) as [number, number, number];
		const hex = c.replace('#', '');
		const full = hex.length === 3 ? hex.split('').map((x) => x + x).join('') : hex;
		if (!/^[0-9a-f]{6}$/i.test(full)) return null;
		const n = parseInt(full, 16);
		return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	}

	/** A theme colour with transparency, as ECharts needs a plain colour string. */
	export function alpha(colour: string, a: number): string {
		const rgb = channels(colour);
		return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})` : colour.trim();
	}

	/**
	 * A richer version of a theme colour. Brand accents can be bright, which
	 * reads as a pale line on a white panel; pulling the line towards black
	 * keeps it solid without dropping it out of the theme.
	 */
	export function darken(colour: string, amount: number): string {
		const rgb = channels(colour);
		if (!rgb) return colour.trim();
		const keep = 1 - Math.min(Math.max(amount, 0), 1);
		return `rgb(${Math.round(rgb[0] * keep)}, ${Math.round(rgb[1] * keep)}, ${Math.round(rgb[2] * keep)})`;
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import type { EChartsCoreOption } from 'echarts/core';

	/**
	 * One ECharts canvas. The library loads in the browser only, after the
	 * page has painted, and the option is rebuilt whenever the console theme
	 * changes so a dark switch never leaves light-mode axes behind.
	 */
	let {
		build,
		height = 240,
		label
	}: {
		/** Turns theme colours into the chart option. Re-run when its inputs change. */
		build: (t: ChartTokens) => EChartsCoreOption;
		height?: number;
		/** What the chart shows, for screen readers. */
		label: string;
	} = $props();

	let el = $state<HTMLDivElement>();
	let chart = $state.raw<{ setOption: (o: EChartsCoreOption, notMerge?: boolean) => void; resize: () => void; dispose: () => void } | null>(null);
	let themeTick = $state(0);

	/** Hidden probe that turns color-mix() and other CSS colours into plain rgb(). */
	function solid(value: string): string {
		if (!value) return value;
		// Hex, rgb() and hsl() are already safe for ECharts and SVG attributes.
		if (/^(#|rgba?\(|hsla?\()/i.test(value)) return value;
		if (typeof document === 'undefined') return value;
		if (!colourProbe) {
			colourProbe = document.createElement('span');
			colourProbe.setAttribute('aria-hidden', 'true');
			colourProbe.style.cssText =
				'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
			document.body.appendChild(colourProbe);
		}
		colourProbe.style.color = value;
		return getComputedStyle(colourProbe).color || value;
	}

	const DARK_THEMES = new Set(['dark', 'night', 'graphite', 'raw', 'midnight']);

	function tokens(node: HTMLElement): ChartTokens {
		const css = getComputedStyle(node);
		const raw = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
		const v = (name: string, fallback: string) => solid(raw(name, fallback));
		return {
			text: v('--text', '#0d1424'),
			text2: v('--text-2', '#4a5568'),
			text3: v('--text-3', '#8b95a8'),
			border: v('--border', '#e4e7ef'),
			grid: v('--chart-grid', raw('--border-subtle', '#edeff5')),
			surface: v('--surface', '#ffffff'),
			surface2: v('--surface-2', '#f7f8fb'),
			card: v('--card-bg', '#ffffff'),
			accent: v('--accent', '#6366f1'),
			accent2: v('--accent-2', '#8b5cf6'),
			success: v('--success', '#15803d'),
			warn: v('--warn', '#b45309'),
			danger: v('--danger', '#b42318'),
			font: raw('--font', 'Inter, system-ui, sans-serif'),
			dark: DARK_THEMES.has(document.documentElement.dataset.theme ?? '')
		};
	}

	onMount(() => {
		let disposed = false;
		let resize: ResizeObserver | undefined;
		const theme = new MutationObserver(() => themeTick++);
		theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });

		void import('./echarts').then((echarts) => {
			if (disposed || !el) return;
			chart = echarts.init(el, undefined, { renderer: 'svg' });
			resize = new ResizeObserver(() => chart?.resize());
			resize.observe(el);
		});

		return () => {
			disposed = true;
			theme.disconnect();
			resize?.disconnect();
			chart?.dispose();
			chart = null;
		};
	});

	$effect(() => {
		void themeTick;
		if (chart && el) chart.setOption(build(tokens(el)), true);
	});
</script>

<div bind:this={el} class="echart" style:height="{height}px" role="img" aria-label={label}></div>

<style>
	.echart {
		width: 100%;
	}
</style>
