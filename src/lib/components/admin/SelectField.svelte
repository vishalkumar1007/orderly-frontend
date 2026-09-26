<script lang="ts">
	type Option = { value: string; label: string };

	let {
		id = '',
		value = $bindable(''),
		options = [] as Option[],
		required = false,
		disabled = false,
		onchange
	}: {
		id?: string;
		value?: string;
		options?: Option[];
		required?: boolean;
		disabled?: boolean;
		/** Optional change callback, for forms that keep the draft upstream. */
		onchange?: (value: string) => void;
	} = $props();

	function handleChange() {
		onchange?.(value);
	}
</script>

<select class="input" {id} {required} {disabled} bind:value onchange={handleChange}>
	{#each options as opt}
		<option value={opt.value}>{opt.label}</option>
	{/each}
</select>
