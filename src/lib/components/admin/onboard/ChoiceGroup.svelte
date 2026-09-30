<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * A keyboard-navigable radio group.
	 *
	 * The wizard's pickers were `<button>`s inside a `role="radiogroup"` with no
	 * `role="radio"` and no `aria-checked` anywhere, so the group announced a
	 * position ("2 of 7") while every member announced itself as an ordinary
	 * push button with no selected state — and Tab then walked through all seven
	 * individually. A radio group is one stop in the tab order with the arrow keys
	 * moving within it, which is what `role="radiogroup"` promises.
	 *
	 * Hand-rolled rather than delegated to native radio inputs because the cards
	 * are buttons containing rich content; a visually hidden input per card would
	 * have to be kept in sync with the same state, and would then be the thing the
	 * space bar activates.
	 */
	let {
		value = '',
		onselect,
		orientation = 'vertical',
		grid = '',
		describedby = '',
		label,
		options = [] as { id: string; disabled?: boolean }[],
		children
	}: {
		value?: string;
		onselect?: (value: string) => void;
		orientation?: 'vertical' | 'horizontal';
		/**
		 * A grid modifier from the onboarding stylesheet — `onb-choices-2`,
		 * `onb-choices-3`. The card layout is identical across the three pickers;
		 * only how many sit per row changes, and seven types, three plans and
		 * seventeen presets each want a different answer. Left to the caller
		 * because the right number is a property of the catalogue's length, which
		 * this component does not know.
		 */
		grid?: string;
		label: string;
		/**
		 * Id of the element holding this group's validation message. When set, the
		 * group is marked invalid and points at it. The caller owns the element so
		 * the message can live wherever it reads best.
		 */
		describedby?: string;
		/** The cards, in tab order. Each needs a stable, attribute-safe `id`. */
		options: { id: string; disabled?: boolean }[];
		children: Snippet<[{ id: string; selected: boolean }]>;
	} = $props();

	let group = $state<HTMLElement | null>(null);

	/**
	 * Where Tab should land inside the group.
	 *
	 * Seeded from the selection, or from the first card when nothing is selected
	 * yet. A roving tabindex whose single `0` is nowhere makes the group
	 * unreachable, so the seed has to be re-evaluated whenever it stops naming a
	 * card that exists — which is not only at construction.
	 */
	let focused = $state('');

	const selectable = $derived(options.filter((option) => !option.disabled));

	/**
	 * The catalogue arrives asynchronously on the first two steps, so the seed
	 * cannot be read in the initialiser: it would capture whatever was on screen
	 * on the first render, which is nothing, and the group would sit there with
	 * no tab stop at all.
	 *
	 * The same effect covers the other two ways `focused` goes stale — a card
	 * being removed from `options`, and a draft being reset — and it never steals
	 * focus from a card that is still present, so a click is not yanked away by
	 * the parent's echo of the same selection back as a prop change.
	 */
	$effect(() => {
		if (selectable.some((option) => option.id === focused)) return;
		// Prefer the selection, but only if it is actually reachable — a draft
		// restored onto a card that is no longer offered must not point the tab
		// stop at nothing.
		focused = (selectable.find((option) => option.id === value) ?? selectable[0])?.id ?? '';
	});

	function select(id: string) {
		focused = id;
		onselect?.(id);
	}

	/**
	 * Roving focus.
	 *
	 * Arrows move *and* select, which is the standard behaviour: a radio has no
	 * separate focus-only state, so there is nothing to move focus to without
	 * also checking it.
	 */
	function onKeydown(event: KeyboardEvent) {
		const steps: Record<string, number> = {
			ArrowDown: 1,
			ArrowRight: 1,
			ArrowUp: -1,
			ArrowLeft: -1
		};
		if (event.key === 'Home' || event.key === 'End') {
			event.preventDefault();
			const target = event.key === 'Home' ? selectable[0] : selectable[selectable.length - 1];
			if (target) {
				select(target.id);
				focusOption(target.id);
			}
			return;
		}

		const step = steps[event.key];
		if (step === undefined || selectable.length === 0) return;
		event.preventDefault();

		const from = selectable.findIndex((option) => option.id === focused);
		// `-1` when nothing matches, which lands on the first card going forwards
		// and the last going backwards — the behaviour the pattern specifies for
		// an unselected group.
		const next = selectable[(from + step + selectable.length) % selectable.length];
		if (next) {
			select(next.id);
			focusOption(next.id);
		}
	}

	/**
	 * Ids reaching here are business-type codes and slugs, but an attribute
	 * selector still needs quoting for anything unusual, and a type code with a
	 * dot or a space in it would otherwise throw on the whole handler.
	 */
	function focusOption(id: string) {
		const escaped = id.replace(/["\\]/g, '\\$&');
		group?.querySelector<HTMLElement>(`[data-option="${escaped}"]`)?.focus();
	}
</script>

<div
	class={[
		'onb-choices',
		orientation === 'horizontal' ? 'onb-presets' : '',
		grid
	]
		.filter(Boolean)
		.join(' ')}
	role="radiogroup"
	aria-label={label}
	aria-orientation={orientation}
	/*
	 * A group's error belongs on the group, not on whichever card happens to be
	 * focused. `aria-invalid` on a `radiogroup` is what tells assistive tech the
	 * whole set is incomplete, and `aria-describedby` is what makes the message
	 * reachable without moving focus off the cards.
	 */
	aria-invalid={describedby ? 'true' : undefined}
	aria-describedby={describedby || undefined}
	bind:this={group}
	onkeydown={onKeydown}
	/*
	 * `-1`, not `0`. The pattern puts one tab stop *inside* the group, on the
	 * checked card, and a `0` here would add a second stop wrapping a group whose
	 * children are already navigable — so the operator would hit the container,
	 * then have to arrow into a card they could have reached directly. `-1` keeps
	 * the container focusable for scripts and for the empty-state case without
	 * putting it in the sequence.
	 */
	tabindex="-1"
>
	{#each options as option (option.id)}
		<button
			type="button"
			role="radio"
			data-option={option.id}
			aria-checked={option.id === value}
			disabled={option.disabled}
			class="onb-choice"
			tabindex={option.id === focused ? 0 : -1}
			onclick={() => select(option.id)}
		>
			{@render children({ id: option.id, selected: option.id === value })}
		</button>
	{/each}
</div>
