<script lang="ts">
	import type { Component } from 'svelte';

	let {
		label,
		value,
		hint = '',
		icon,
		accent = false
	}: {
		label: string;
		value: string | number;
		hint?: string;
		icon?: Component;
		/** Tint the number with the brand colour. */
		accent?: boolean;
	} = $props();
</script>

<div class={['osstat', accent ? 'accent' : ''].join(' ')}>
	<div class="osstat-label">
		{#if icon}
			{@const Icon = icon}
			<Icon size={12} strokeWidth={2} style="vertical-align:-1px;margin-right:0.2rem;" />
		{/if}
		{label}
	</div>
	<p class="osstat-value">{value}</p>
	{#if hint}<div class="osstat-hint">{hint}</div>{/if}
</div>
