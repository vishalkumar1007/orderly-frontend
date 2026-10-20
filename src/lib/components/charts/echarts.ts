/**
 * The slice of Apache ECharts the console uses. Registering only these keeps
 * the chart code a fraction of the full library, and it is only ever loaded
 * by a page that draws a chart (see EChart.svelte).
 */
import * as echarts from 'echarts/core';
import { BarChart, HeatmapChart, LineChart, PieChart } from 'echarts/charts';
import {
	GridComponent,
	MarkLineComponent,
	MarkPointComponent,
	TooltipComponent,
	VisualMapComponent
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([
	LineChart,
	BarChart,
	PieChart,
	HeatmapChart,
	GridComponent,
	TooltipComponent,
	MarkLineComponent,
	MarkPointComponent,
	VisualMapComponent,
	SVGRenderer
]);

export const init = echarts.init;
export const graphic = echarts.graphic;
