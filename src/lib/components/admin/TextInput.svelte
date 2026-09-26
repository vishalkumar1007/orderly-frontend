<script lang="ts">
	type Autocomplete = HTMLInputElement['autocomplete'];
	/** `inputmode` is a valid HTML attribute but is absent from lib.dom typings. */
	type InputMode = 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';

	let {
		id = '',
		value = $bindable(''),
		type = 'text',
		placeholder = '',
		required = false,
		disabled = false,
		autocomplete = undefined as Autocomplete | undefined,
		min = undefined as number | string | undefined,
		max = undefined as number | string | undefined,
		step = undefined as number | string | undefined,
		maxlength = undefined as number | undefined,
		inputmode = undefined as InputMode | undefined,
		/** A short unit rendered inside the field, e.g. "min" or "%". */
		suffix = '',
		onblur,
		oninput
	}: {
		id?: string;
		value?: string;
		type?: string;
		placeholder?: string;
		required?: boolean;
		disabled?: boolean;
		autocomplete?: Autocomplete;
		min?: number | string;
		max?: number | string;
		step?: number | string;
		maxlength?: number;
		/** Forces the numeric keypad on phones. */
		inputmode?: InputMode;
		suffix?: string;
		onblur?: (e: FocusEvent) => void;
		oninput?: (e: Event) => void;
	} = $props();
</script>

<span style="position:relative;display:block;">
	<input
		class="input"
		style={suffix ? 'padding-right:2.2rem;' : ''}
		{id}
		{type}
		{placeholder}
		{required}
		{disabled}
		autocomplete={autocomplete}
		{min}
		{max}
		{step}
		{maxlength}
		{inputmode}
		bind:value
		{onblur}
		{oninput}
	/>
	{#if suffix}
		<span
			style="position:absolute;right:0.7rem;top:50%;transform:translateY(-50%);font-size:0.75rem;color:var(--text-3);pointer-events:none;"
			aria-hidden="true"
		>
			{suffix}
		</span>
	{/if}
</span>
