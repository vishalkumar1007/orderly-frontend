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
			<div class="sx-rail-group">
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
						<span class="sx-rail-icon" aria-hidden="true"><item.icon size={15} stroke={1.7} /></span>
						<span class="sx-rail-text">{item.label}</span>
					</button>
				{/each}
			</div>
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
			grid-template-columns: 15rem minmax(0, 1fr);
		}
	}

	/* The rail is a card of its own, like every other panel in the console. */
	.sx-rail {
		display: flex;
		flex-direction: column;
		gap: var(--sp-6);
		padding: var(--sp-5);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--card-bg);
	}

	.sx-rail-group {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	@media (min-width: 1000px) {
		.sx-rail {
			position: sticky;
			top: calc(var(--topbar-h) + var(--sp-8));
		}
	}

	/* On a phone the rail becomes a scrolling row of chips, so it does not read as part of the form. */
	@media (max-width: 999px) {
		.sx-rail,
		.sx-rail-group {
			flex-direction: row;
		}

		.sx-rail {
			overflow-x: auto;
			gap: var(--sp-2);
			padding: var(--sp-3);
		}

		.sx-rail-label {
			display: none;
		}

		.sx-rail-link.on::before {
			display: none;
		}
	}

	.sx-rail-label {
		margin: 0 0 var(--sp-2);
		padding: 0 var(--sp-4);
		font-size: var(--fs-label);
		font-weight: 650;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-3);
	}

	.sx-rail-link {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		min-height: 36px;
		padding: var(--sp-2) var(--sp-4);
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--text-2);
		font: inherit;
		font-size: var(--fs-body);
		font-weight: 550;
		text-align: left;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background 0.12s,
			color 0.12s;
	}

	.sx-rail-icon {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		flex: none;
		border-radius: 7px;
		background: var(--surface-2);
		color: var(--text-3);
		transition:
			background 0.12s,
			color 0.12s;
	}

	.sx-rail-text {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sx-rail-link:hover {
		background: var(--surface-2);
		color: var(--text);
	}

	.sx-rail-link:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	.sx-rail-link.on {
		color: var(--text);
		font-weight: 650;
		background: color-mix(in srgb, var(--accent) 10%, transparent);
	}

	.sx-rail-link.on .sx-rail-icon {
		background: var(--accent);
		color: var(--on-accent, #fff);
	}

	/* A short bar on the left edge marks where you are. */
	.sx-rail-link.on::before {
		content: '';
		position: absolute;
		left: calc(-1 * var(--sp-5));
		top: 8px;
		bottom: 8px;
		width: 3px;
		border-radius: 0 3px 3px 0;
		background: var(--accent);
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
