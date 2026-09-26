<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';

	let {
		children,
		delay = 0,
		as: Tag = 'div',
		class: className = ''
	}: {
		children: Snippet;
		/** Stagger, in ms. Applied as transition-delay. */
		delay?: number;
		as?: 'div' | 'section' | 'article' | 'li';
		class?: string;
	} = $props();

	let el = $state<HTMLElement | null>(null);
	let visible = $state(false);

	onMount(() => {
		const node = el;
		if (!node) return;

		// Respect the OS setting: show content immediately, no motion.
		if (
			typeof window.matchMedia === 'function' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		) {
			visible = true;
			return;
		}
		if (typeof IntersectionObserver === 'undefined') {
			visible = true;
			return;
		}

		const io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						visible = true;
						io.unobserve(entry.target);
					}
				}
			},
			{ threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
		);
		io.observe(node);
		return () => io.disconnect();
	});
</script>

<svelte:element
	this={Tag}
	bind:this={el}
	class={['reveal', visible ? 'in-view' : '', className].join(' ').trim()}
	style:transition-delay={delay ? `${delay}ms` : undefined}
>
	{@render children()}
</svelte:element>
