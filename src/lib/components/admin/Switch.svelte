<script lang="ts">
	let {
		checked = $bindable(false),
		label,
		hint = '',
		disabled = false,
		onchange
	}: {
		checked?: boolean;
		label: string;
		hint?: string;
		disabled?: boolean;
		/** Optional change callback, for toggles that act immediately. */
		onchange?: (checked: boolean) => void;
	} = $props();

	function handleChange() {
		onchange?.(checked);
	}
</script>

<label class="switch" style={disabled ? 'opacity:.55;cursor:not-allowed;' : ''}>
	<input type="checkbox" bind:checked {disabled} onchange={handleChange} />
	<span class="switch-track"></span>
	<span>
		{label}
		{#if hint}<span class="field-hint" style="display:block;">{hint}</span>{/if}
	</span>
</label>
