<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import MoreHorizontal from '@tabler/icons-svelte/icons/dots';

	type Item = {
		label: string;
		icon?: Snippet;
		onclick?: () => void;
		href?: string;
		danger?: boolean;
		disabled?: boolean;
		separatorBefore?: boolean;
	};

	let {
		items = [] as Item[],
		label = 'More actions',
		align = 'right'
	}: {
		items?: Item[];
		label?: string;
		align?: 'left' | 'right';
	} = $props();

	let open = $state(false);
	let rootEl = $state<HTMLDivElement | null>(null);
	let triggerEl = $state<HTMLButtonElement | null>(null);
	let itemsEl = $state<HTMLDivElement | null>(null);
	let activeIndex = $state(-1);

	const enabledIndexes = $derived(items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0));

	function close(refocus = false) {
		open = false;
		activeIndex = -1;
		if (refocus) triggerEl?.focus();
	}

	function focusItem(i: number) {
		const el = itemsEl?.querySelectorAll<HTMLElement>('[role="menuitem"]')[i];
		el?.focus();
	}

	function step(delta: number) {
		if (enabledIndexes.length === 0) return;
		const pos = enabledIndexes.indexOf(activeIndex);
		const next =
			pos === -1
				? (delta > 0 ? enabledIndexes[0] : enabledIndexes[enabledIndexes.length - 1])
				: enabledIndexes[(pos + delta + enabledIndexes.length) % enabledIndexes.length];
		activeIndex = next;
		focusItem(enabledIndexes.indexOf(next));
	}

	function onListKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.stopPropagation();
			close(true);
			return;
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			step(1);
			return;
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			step(-1);
			return;
		}
		if (e.key === 'Tab') close();
	}

	function closeFromEvent() {
		close();
	}

	function onTriggerKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			open = true;
			activeIndex = enabledIndexes[0] ?? -1;
			queueMicrotask(() => focusItem(0));
		}
	}

	/**
	 * The list is placed against the window (position: fixed) from the
	 * trigger's position, not inside the row. An absolutely placed list was cut
	 * off by any container that hides overflow, such as a table card. It opens
	 * upward when there is no room below, and follows its button on scroll or
	 * resize (closing on scroll made it shut itself the moment focusing the
	 * first item scrolled the page).
	 */
	let placement = $state('');

	function place() {
		const t = triggerEl?.getBoundingClientRect();
		if (!t) return;
		const listH = itemsEl?.offsetHeight ?? 0;
		const gap = 5;
		const below = window.innerHeight - t.bottom - gap;
		const up = listH > 0 && below < listH && t.top - gap > below;
		// Every edge is set, so the stylesheet's absolute top/right never mixes in.
		const vertical = up
			? `top:auto;bottom:${window.innerHeight - t.top + gap}px;`
			: `top:${t.bottom + gap}px;bottom:auto;`;
		const horizontal =
			align === 'left'
				? `left:${Math.max(8, t.left)}px;right:auto;`
				: `right:${Math.max(8, window.innerWidth - t.right)}px;left:auto;`;
		placement = `position:fixed;${vertical}${horizontal}`;
	}

	$effect(() => {
		if (!open) return;
		place();
		activeIndex = enabledIndexes[0] ?? -1;
		// Measure again once the list exists, so it can flip upward if needed.
		requestAnimationFrame(() => {
			place();
			focusItem(0);
		});
		let frame = 0;
		const follow = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(place);
		};
		window.addEventListener('scroll', follow, { capture: true, passive: true });
		window.addEventListener('resize', follow);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener('scroll', follow, { capture: true });
			window.removeEventListener('resize', follow);
		};
	});

	onMount(() => {
		const onDoc = (e: MouseEvent) => {
			if (open && !rootEl?.contains(e.target as Node)) close();
		};
		document.addEventListener('mousedown', onDoc);
		return () => document.removeEventListener('mousedown', onDoc);
	});
</script>

<div class="menu" bind:this={rootEl}>
	<button
		type="button"
		class="btn btn-ghost btn-sm"
		bind:this={triggerEl}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label={label}
		title={label}
		onclick={() => (open = !open)}
		onkeydown={onTriggerKeydown}
	>
		<MoreHorizontal size={16} stroke={1.6} />
	</button>

	{#if open}
		<button
			type="button"
			class="cmd-backdrop"
			tabindex="-1"
			aria-hidden="true"
			onclick={closeFromEvent}
		></button>
		<div
			class={['menu-list', align === 'left' ? 'align-left' : ''].join(' ')}
			role="menu"
			tabindex="-1"
			aria-label={label}
			style={placement}
			bind:this={itemsEl}
			onkeydown={onListKeydown}
		>
			{#each items as item, i (item.label)}
				{#if item.separatorBefore && i > 0}
					<div class="menu-sep" role="separator"></div>
				{/if}
				{#if item.href}
					<a
						class={['menu-item', item.danger ? 'danger' : ''].join(' ')}
						role="menuitem"
						href={item.href}
						tabindex="-1"
						onclick={closeFromEvent}
					>
						{#if item.icon}{@render item.icon()}{/if}
						{item.label}
					</a>
				{:else}
					<button
						type="button"
						class={['menu-item', item.danger ? 'danger' : ''].join(' ')}
						role="menuitem"
						tabindex="-1"
						disabled={item.disabled}
						onclick={() => {
							close(true);
							item.onclick?.();
						}}
					>
						{#if item.icon}{@render item.icon()}{/if}
						{item.label}
					</button>
				{/if}
			{/each}
		</div>
	{/if}
</div>
