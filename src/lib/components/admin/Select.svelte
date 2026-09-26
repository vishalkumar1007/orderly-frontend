<script lang="ts">
	type Option = { value: string; label: string };

	let {
		value = $bindable(''),
		options = [] as Option[],
		label = '',
		id = 'select',
		allLabel = 'All',
		/** Set to an empty string to drop the leading blank option. */
		placeholder = '',
		/** Hides the `.field` wrapper so the select can sit inline in a row. */
		inline = false,
		ariaLabel = '',
		onchange
	}: {
		value?: string;
		options?: Option[];
		label?: string;
		id?: string;
		allLabel?: string;
		placeholder?: string;
		inline?: boolean;
		ariaLabel?: string;
		onchange?: (value: string) => void;
	} = $props();

	const select = $derived.by(() => (inline ? '' : 'field'));
</script>

{#if inline}
	<select class="input" {id} bind:value aria-label={ariaLabel || label} onchange={() => onchange?.(value)}>
		{#if placeholder}<option value="">{placeholder}</option>{/if}
		{#each options as opt (opt.value)}
			<option value={opt.value}>{opt.label}</option>
		{/each}
	</select>
{:else}
	<div class={select}>
		{#if label}<label class="field-label" for={id}>{label}</label>{/if}
		<select class="input" {id} bind:value aria-label={ariaLabel || undefined} onchange={() => onchange?.(value)}>
			{#if allLabel}<option value="">{allLabel}</option>{/if}
			{#each options as opt (opt.value)}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
	</div>
{/if}
