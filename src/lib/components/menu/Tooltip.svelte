<script lang="ts">
	import { Info } from '@lucide/svelte/icons';

	let {
		text,
		position = 'top'
	}: {
		text: string;
		position?: 'top' | 'bottom' | 'left' | 'right';
	} = $props();
</script>

<span class="tooltip-wrap" tabindex="0" role="tooltip" aria-label={text}>
	<Info size={14} strokeWidth={2} />
	<span class="tooltip-bubble" class:top={position === 'top'} class:bottom={position === 'bottom'} class:left={position === 'left'} class:right={position === 'right'}>
		{text}
	</span>
</span>

<style>
	.tooltip-wrap {
		position: relative;
		display: inline-flex;
		align-items: center;
		color: var(--text-3);
		cursor: help;
		outline: none;
	}

	.tooltip-wrap:hover,
	.tooltip-wrap:focus-visible {
		color: var(--accent-dark);
	}

	.tooltip-bubble {
		position: absolute;
		z-index: 50;
		padding: 0.35rem 0.6rem;
		background: var(--text);
		color: var(--bg);
		font-size: var(--fs-meta);
		font-weight: 500;
		line-height: 1.4;
		border-radius: 6px;
		white-space: nowrap;
		pointer-events: none;
	 opacity: 0;
		visibility: hidden;
		transform: translateY(2px);
		transition: opacity var(--tr), transform var(--tr), visibility var(--tr);
	}

	.tooltip-wrap:hover .tooltip-bubble,
	.tooltip-wrap:focus-visible .tooltip-bubble {
		opacity: 1;
		visibility: visible;
		transform: none;
	}

	.tooltip-bubble.top {
		bottom: calc(100% + 0.4rem);
		left: 50%;
		transform: translateX(-50%) translateY(2px);
	}

	.tooltip-wrap:hover .tooltip-bubble.top,
	.tooltip-wrap:focus-visible .tooltip-bubble.top {
		transform: translateX(-50%);
	}

	.tooltip-bubble.bottom {
		top: calc(100% + 0.4rem);
		left: 50%;
		transform: translateX(-50%) translateY(-2px);
	}

	.tooltip-wrap:hover .tooltip-bubble.bottom,
	.tooltip-wrap:focus-visible .tooltip-bubble.bottom {
		transform: translateX(-50%);
	}

	.tooltip-bubble.left {
		right: calc(100% + 0.4rem);
		top: 50%;
		transform: translateY(-50%) translateX(2px);
	}

	.tooltip-wrap:hover .tooltip-bubble.left,
	.tooltip-wrap:focus-visible .tooltip-bubble.left {
		transform: translateY(-50%);
	}

	.tooltip-bubble.right {
		left: calc(100% + 0.4rem);
		top: 50%;
		transform: translateY(-50%) translateX(-2px);
	}

	.tooltip-wrap:hover .tooltip-bubble.right,
	.tooltip-wrap:focus-visible .tooltip-bubble.right {
		transform: translateY(-50%);
	}
</style>
