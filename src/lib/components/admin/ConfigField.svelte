<script lang="ts">
	import type { Snippet } from 'svelte';
	import FormField from './FormField.svelte';
	import SelectField from './SelectField.svelte';
	import StatusBadge from './StatusBadge.svelte';
	import TextInput from './TextInput.svelte';

	type Option = { value: string; label: string };

	let {
		id,
		label,
		hint = '',
		type = 'text',
		placeholder = '',
		options = null as Option[] | null,
		secret = false,
		set = false,
		onvalue
	}: {
		id: string;
		label: string;
		hint?: string;
		type?: string;
		placeholder?: string;
		options?: Option[] | null;
		/** Render as a password with a keep-current affordance. */
		secret?: boolean;
		/** A secret is already stored, so show it as set rather than empty. */
		set?: boolean;
		onvalue: (value: string) => void;
	} = $props();

	// Local state so the input can use bind:value, matching every other form in
	// the app. Changes are pushed up immediately; the parent owns the draft.
	let local = $state('');
	let touched = $state(false);

	function push(v: string) {
		local = v;
		onvalue(v);
	}
</script>

<FormField {label} htmlFor={id} {hint}>
	{#if options}
		<SelectField
			{id}
			bind:value={local}
			{options}
			onchange={() => push(local)}
		/>
	{:else if secret}
		<div class="secret">
			<TextInput
				{id}
				type="password"
				bind:value={local}
				{placeholder}
				autocomplete="new-password"
				oninput={() => {
					touched = true;
					push(local);
				}}
			/>
			{#if set && !touched}
				<StatusBadge status="SET" kind="ok" dot={false} />
			{/if}
		</div>
	{:else if type === 'number'}
		<TextInput
			{id}
			type="number"
			bind:value={local}
			{placeholder}
			oninput={() => push(local)}
		/>
	{:else}
		<TextInput {id} {type} bind:value={local} {placeholder} oninput={() => push(local)} />
	{/if}
</FormField>

<style>
	.secret {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
	}

	.secret :global(input) {
		flex: 1;
		min-width: 0;
	}
</style>
