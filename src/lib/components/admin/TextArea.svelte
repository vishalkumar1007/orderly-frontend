<script lang="ts">
	let {
		id = '',
		value = $bindable(''),
		rows = 3,
		maxlength = undefined as number | undefined,
		placeholder = '',
		required = false,
		disabled = false,
		oninput
	}: {
		id?: string;
		value?: string;
		rows?: number;
		maxlength?: number;
		placeholder?: string;
		required?: boolean;
		disabled?: boolean;
		/** Fires on every keystroke. Needed where a field is not `bind`-able. */
		oninput?: (e: Event) => void;
	} = $props();
</script>

<textarea
	class="input"
	{id}
	{rows}
	{maxlength}
	{placeholder}
	{required}
	{disabled}
	bind:value
	{oninput}
></textarea>
