<script lang="ts">
	import Search from '@lucide/svelte/icons/search';

	let {
		value = $bindable(''),
		placeholder = 'Search…',
		label = 'Search',
		id = 'search'
	}: {
		value?: string;
		placeholder?: string;
		label?: string;
		id?: string;
	} = $props();
</script>

<div class="field field-grow">
	{#if label}<label class="field-label" for={id}>{label}</label>{/if}
	<div style="position:relative;display:flex;align-items:center;">
		<span style="position:absolute;left:0.65rem;display:inline-flex;color:var(--text-3);pointer-events:none;">
			<Search size={15} strokeWidth={1.9} />
		</span>
		<input
			class="input"
			{id}
			type="text"
			{placeholder}
			bind:value
			style="padding-left:2.1rem;"
		/>
	</div>
</div>
