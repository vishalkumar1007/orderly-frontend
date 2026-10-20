<script lang="ts">
	/**
	 * The one card every Configuration screen is built from: a title and a
	 * line saying what it is for, an optional badge or action on the right,
	 * the content, and an optional footer bar (a note left, buttons right).
	 *
	 * One shape everywhere is what makes the screens read as one product.
	 */
	import type { Snippet } from 'svelte';

	let {
		title,
		description = '',
		id,
		flush = false,
		aside,
		footer,
		footnote = '',
		children
	}: {
		title: string;
		description?: string;
		/** Used for aria-labelledby; pass one when a page has several cards. */
		id?: string;
		/** Body without padding, for rows and grids that run edge to edge. */
		flush?: boolean;
		/** Right side of the header: a status badge or a small action. */
		aside?: Snippet;
		/** Buttons in the footer bar, right-aligned. */
		footer?: Snippet;
		/** A short note at the left of the footer bar. */
		footnote?: string;
		children: Snippet;
	} = $props();
</script>

<section class="cc" aria-labelledby={id ? `${id}-h` : undefined}>
	<header class="cc-head">
		<div class="cc-titles">
			<h3 class="cc-title" id={id ? `${id}-h` : undefined}>{title}</h3>
			{#if description}<p class="cc-desc">{description}</p>{/if}
		</div>
		{#if aside}<div class="cc-aside">{@render aside()}</div>{/if}
	</header>

	<div class="cc-body" class:cc-flush={flush}>
		{@render children()}
	</div>

	{#if footer || footnote}
		<footer class="cc-foot">
			<span class="cc-note">{footnote}</span>
			{#if footer}<div class="cc-actions">{@render footer()}</div>{/if}
		</footer>
	{/if}
</section>

<style>
	.cc {
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--card-bg, var(--surface));
		overflow: hidden;
	}

	.cc-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--sp-8);
		padding: var(--sp-9) var(--sp-10) 0;
	}

	.cc-titles {
		min-width: 0;
	}

	.cc-title {
		margin: 0;
		font-size: var(--fs-body);
		font-weight: 650;
		color: var(--text);
	}

	.cc-desc {
		margin: var(--sp-2) 0 0;
		font-size: var(--fs-tab);
		line-height: 1.5;
		color: var(--text-3);
	}

	.cc-aside {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		flex: none;
	}

	.cc-body {
		padding: var(--sp-8) var(--sp-10) var(--sp-9);
	}

	.cc-flush {
		padding: var(--sp-6) 0 0;
	}

	.cc-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-6);
		flex-wrap: wrap;
		padding: var(--sp-6) var(--sp-10);
		border-top: 1px solid var(--border-subtle);
		background: var(--surface-2);
	}

	.cc-note {
		font-size: var(--fs-meta);
		color: var(--text-3);
	}

	.cc-actions {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		flex-wrap: wrap;
		margin-left: auto;
	}

	@media (max-width: 560px) {
		.cc-head {
			flex-direction: column;
			padding: var(--sp-8) var(--sp-8) 0;
		}
		.cc-body {
			padding: var(--sp-7) var(--sp-8) var(--sp-8);
		}
		.cc-foot {
			padding: var(--sp-6) var(--sp-8);
		}
	}
</style>
