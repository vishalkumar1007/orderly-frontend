<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		htmlFor = '',
		error = '',
		hint = '',
		required = false,
		children
	}: {
		label: string;
		htmlFor?: string;
		error?: string;
		hint?: string;
		required?: boolean;
		children: Snippet;
	} = $props();
</script>

<div class="field">
	<label class="field-label" for={htmlFor}>
		{label}{#if required}<span style="color: var(--danger);"> *</span>{/if}
	</label>
	{@render children()}
	{#if error}
		<p class="field-error">{error}</p>
	{:else if hint}
		<p class="field-hint">{hint}</p>
	{/if}
</div>
