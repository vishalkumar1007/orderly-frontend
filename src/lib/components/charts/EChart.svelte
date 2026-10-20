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
		accent: string;
		accent2: string;
		success: string;
		warn: string;
		danger: string;
		font: string;
	};

	/** A theme colour with transparency, as ECharts needs a plain colour string. */
	export function alpha(colour: string, a: number): string {
		const hex = colour.trim().replace('#', '');
		const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
		if (!/^[0-9a-f]{6}$/i.test(full)) return colour;
		const n = parseInt(full, 16);
		return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
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

	function tokens(node: HTMLElement): ChartTokens {
		const css = getComputedStyle(node);
		const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
		return {
			text: v('--text', '#0d1424'),
			text2: v('--text-2', '#4a5568'),
			text3: v('--text-3', '#8b95a8'),
			border: v('--border', '#e4e7ef'),
			grid: v('--border-subtle', '#edeff5'),
			surface: v('--surface', '#ffffff'),
			surface2: v('--surface-2', '#f7f8fb'),
			accent: v('--accent', '#6366f1'),
			accent2: v('--accent-2', '#8b5cf6'),
			success: v('--success', '#15803d'),
			warn: v('--warn', '#b45309'),
			danger: v('--danger', '#b42318'),
			font: v('--font', 'Inter, system-ui, sans-serif')
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
