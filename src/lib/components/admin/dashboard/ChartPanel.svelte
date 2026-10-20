<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * One chart card: title, a context line, optional controls and a footer
	 * that says what the chart means. Keeping the chrome here means every
	 * panel on the dashboard has the same header rhythm, and the chart
	 * components only carry their own body.
	 */
	let {
		title,
		subtitle = '',
		actions,
		footer,
		children,
		extra = ''
	}: {
		title: string;
		subtitle?: string;
		actions?: Snippet;
		footer?: Snippet;
		children: Snippet;
		/** Extra class for layout, e.g. a panel that must stretch. */
		extra?: string;
	} = $props();
</script>

<section class={['panel', 'panel-flush', 'chart-panel', extra].join(' ')}>
	<header class="head">
		<div class="head-text">
			<h3>{title}</h3>
			{#if subtitle}<p>{subtitle}</p>{/if}
		</div>
		{#if actions}
			<div class="acts">{@render actions()}</div>
		{/if}
	</header>

	<div class="body">{@render children()}</div>

	{#if footer}
		<footer>{@render footer()}</footer>
	{/if}
</section>

<style>
	.chart-panel {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
		padding: 1.1rem 1.25rem 0.75rem;
	}

	.head-text {
		min-width: 0;
	}

	h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 14px;
		font-weight: 650;
		letter-spacing: -0.01em;
		color: var(--text);
	}

	p {
		margin: 0.18rem 0 0;
		font-size: var(--fs-code);
		color: var(--text-3);
		line-height: 1.4;
		font-variant-numeric: tabular-nums;
	}

	.acts {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	/* One line, pinned to the bottom, so footers in a row share a baseline. */
	footer {
		margin: 0;
		padding: 0.75rem 1.25rem;
		border-top: 1px solid var(--border-subtle);
		font-size: var(--fs-code);
		color: var(--text-3);
		line-height: 1.5;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	footer :global(strong) {
		color: var(--text-2);
		font-weight: 600;
	}

	footer :global(a) {
		color: var(--accent-dark);
		font-weight: 600;
		text-decoration: none;
	}

	footer :global(a:hover) {
		text-decoration: underline;
	}
</style>
