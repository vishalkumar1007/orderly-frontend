<script lang="ts">
	import type { Snippet } from 'svelte';
	import type IconBell from '@tabler/icons-svelte/icons/bell';

	export type ShellItem = { id: string; label: string; icon: typeof IconBell };
	export type ShellGroup = { label: string; items: ShellItem[] };

	/**
	 * The frame both consoles' Settings screens share: a section rail on the
	 * left, the section's title and one-line purpose on top, its content below.
	 *
	 * It used to be copied into each console's page along with ~120 lines of rail
	 * styling, and the two copies had already drifted (different widths, different
	 * active colours). One frame means a change here changes both, and a section
	 * only ever supplies its content.
	 */
	let {
		groups,
		activeId,
		title,
		lede = '',
		onselect,
		notice,
		children
	}: {
		groups: ShellGroup[];
		activeId: string;
		title: string;
		lede?: string;
		onselect: (id: string) => void;
		/** Page-level message above the content, e.g. "could not load your settings". */
		notice?: Snippet;
		children: Snippet;
	} = $props();
</script>

<div class="sx-shell">
	<nav class="sx-rail" aria-label="Settings sections">
		{#each groups as group (group.label)}
			<p class="sx-rail-label">{group.label}</p>
			{#each group.items as item (item.id)}
				{@const on = item.id === activeId}
				<button
					type="button"
					class="sx-rail-link"
					class:on
					aria-current={on ? 'page' : undefined}
					onclick={() => onselect(item.id)}
				>
					<item.icon size={15} stroke={1.6} />
					<span>{item.label}</span>
				</button>
			{/each}
		{/each}
	</nav>

	<div class="sx-main">
		<header class="sx-head">
			<h1>{title}</h1>
			{#if lede}<p>{lede}</p>{/if}
		</header>
		{#if notice}{@render notice()}{/if}
		<div class="sx-body">{@render children()}</div>
	</div>
</div>

<style>
	.sx-shell {
		display: grid;
		gap: var(--sp-11);
		align-items: start;
	}

	@media (min-width: 1000px) {
		.sx-shell {
			grid-template-columns: 13rem minmax(0, 1fr);
		}
	}

	.sx-rail {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
	}

	@media (min-width: 1000px) {
		.sx-rail {
			position: sticky;
			top: calc(var(--topbar-h) + var(--sp-8));
		}
	}

	/* On a phone the rail becomes a scrolling row, so it does not read as part of the form. */
	@media (max-width: 999px) {
		.sx-rail {
			flex-direction: row;
			overflow-x: auto;
			gap: var(--sp-2);
			padding-bottom: var(--sp-3);
			border-bottom: 1px solid var(--border-subtle);
		}

		.sx-rail-label {
			display: none;
		}
	}

	.sx-rail-label {
		margin: var(--sp-8) 0 var(--sp-2);
		padding: 0 var(--sp-5);
		font-size: var(--fs-label);
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--text-3);
	}

	.sx-rail-label:first-child {
		margin-top: 0;
	}

	.sx-rail-link {
		display: flex;
		align-items: center;
		gap: var(--sp-5);
		height: 30px;
		padding: 0 var(--sp-5);
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--text-2);
		font: inherit;
		font-size: var(--fs-body);
		font-weight: 500;
		white-space: nowrap;
		cursor: default;
		transition:
			background 0.1s,
			color 0.1s;
	}

	.sx-rail-link :global(svg) {
		color: var(--text-3);
		flex-shrink: 0;
	}

	.sx-rail-link:hover {
		background: var(--surface-hover);
		color: var(--text);
	}

	.sx-rail-link.on {
		color: var(--accent);
		background: color-mix(in srgb, var(--accent) 14%, transparent);
	}

	.sx-rail-link.on :global(svg) {
		color: var(--accent);
	}

	.sx-main {
		min-width: 0;
		max-width: 56rem;
	}

	.sx-head {
		margin-bottom: var(--sp-10);
		padding-bottom: var(--sp-8);
		border-bottom: 1px solid var(--border-subtle);
	}

	h1 {
		margin: 0;
		font-size: var(--fs-h1);
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--text);
		line-height: 1.25;
	}

	.sx-head p {
		margin: var(--sp-3) 0 0;
		font-size: var(--fs-tab);
		line-height: 1.55;
		color: var(--text-3);
		max-width: 40rem;
	}

	.sx-body {
		display: flex;
		flex-direction: column;
		gap: var(--sp-11);
	}
</style>
