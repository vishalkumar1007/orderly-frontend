<script lang="ts">
	import { tick } from 'svelte';

	type Tab = { id: string; label: string };

	let {
		tabs = [] as Tab[],
		active = $bindable(''),
		onchange
	}: {
		tabs?: Tab[];
		active?: string;
		onchange?: (id: string) => void;
	} = $props();

	let railEl = $state<HTMLDivElement | null>(null);
	/**
	 * One indicator that slides to the active tab, rather than each button
	 * drawing its own underline — a tab change reads as the same mark moving,
	 * not a new one appearing, which is what makes switching feel continuous
	 * instead of a hard cut.
	 */
	let indicator = $state({ left: 0, width: 0, ready: false });

	function measure() {
		const rail = railEl;
		const current = rail?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
		if (!rail || !current) return;
		const railBox = rail.getBoundingClientRect();
		const tabBox = current.getBoundingClientRect();
		indicator = { left: tabBox.left - railBox.left, width: tabBox.width, ready: true };
	}

	$effect(() => {
		// Re-measure whenever the active tab or the tab set itself changes.
		active;
		tabs;
		tick().then(measure);
	});

	function select(id: string) {
		active = id;
		onchange?.(id);
	}
</script>

<svelte:window onresize={measure} />

<div class="tabs" role="tablist" bind:this={railEl}>
	{#each tabs as tab (tab.id)}
		<button
			type="button"
			role="tab"
			aria-selected={active === tab.id}
			onclick={() => select(tab.id)}
		>
			{tab.label}
		</button>
	{/each}
	<span
		class="tabs-indicator"
		class:is-ready={indicator.ready}
		style="left:{indicator.left}px;width:{indicator.width}px;"
	></span>
</div>
