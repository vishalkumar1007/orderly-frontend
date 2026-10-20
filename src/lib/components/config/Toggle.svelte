<script lang="ts">
	/**
	 * The console's switch without its own caption, for a ConfigRow that shows
	 * the label on the left. Same `.switch` styles, so it looks identical.
	 */
	let {
		checked = $bindable(false),
		id,
		label,
		disabled = false,
		onchange
	}: {
		checked?: boolean;
		id: string;
		/** Read by screen readers; the row shows the visible label. */
		label: string;
		disabled?: boolean;
		onchange?: (checked: boolean) => void;
	} = $props();
</script>

<label class="switch cfg-toggle" style={disabled ? 'opacity:.55;cursor:not-allowed;' : ''}>
	<input {id} type="checkbox" bind:checked {disabled} aria-label={label} onchange={() => onchange?.(checked)} />
	<span class="switch-track"></span>
</label>

<style>
	.cfg-toggle {
		gap: 0;
	}
</style>
