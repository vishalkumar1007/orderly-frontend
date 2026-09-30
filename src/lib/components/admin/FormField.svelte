<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * The ids and state the control needs, generated here so a caller cannot get
	 * the wiring wrong by forgetting it.
	 */
	export type FieldControl = {
		id: string;
		'aria-required'?: string;
		'aria-invalid'?: string;
		'aria-describedby'?: string;
	};

	/**
	 * A labelled form control with its message wired to the control.
	 *
	 * This used to render a label, the control and an error message as three
	 * siblings and stop there. Nothing connected them: the control never got
	 * `aria-invalid`, and the message was never referenced by `aria-describedby`,
	 * so every validation error in every settings panel in the product was drawn
	 * on screen and silent to a screen reader. A field that says "Required" and
	 * does not say it aloud is not validated, it is decorated.
	 *
	 * ## Two ways to use it
	 *
	 * The snippet form wires the message to the control. Spread `control` onto
	 * the input and it is done:
	 *
	 *     <FormField label="Business name" htmlFor="org-name" error={errors.name}>
	 *       {#snippet children(control)}
	 *         <TextInput id="org-name" bind:value={org.name} {...control} />
	 *       {/snippet}
	 *     </FormField>
	 *
	 * The plain form — `<FormField …><TextInput id="org-name" /></FormField>` —
	 * still works and is what the ~85 existing call sites use. It gets the label,
	 * the `role="alert"` on the message, and the matching `for`/`id`, but cannot
	 * reach inside the control to add `aria-describedby`, because the component
	 * has no reference to it. Converting a call site is therefore a one-line
	 * change; the ones that have not been converted yet are quieter, not wrong,
	 * and the error is still announced when it appears.
	 */
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
		children?: Snippet<[control?: FieldControl]>;
	} = $props();

	/**
	 * A stable id for the message, so `aria-describedby` can point at something.
	 *
	 * Derived from the control's own id rather than a fresh random one: a field
	 * that re-renders must not leave the control pointing at an id that has since
	 * been replaced, and the field's own name is already unique on the page.
	 */
	const messageId = $derived(htmlFor ? `${htmlFor}-message` : '');

	/**
	 * One slot for both. A field that is in error and also has a hint would
	 * otherwise need two ids and a `describedby` list; showing the error alone
	 * matches what the markup already did, so it is kept.
	 */
	const describedBy = $derived(error ? messageId : '');

	const control = $derived<FieldControl>({
		id: htmlFor,
		'aria-required': required ? 'true' : undefined,
		'aria-invalid': error ? 'true' : undefined,
		'aria-describedby': describedBy || undefined
	});
</script>

<div class="field">
	<label class="field-label" for={htmlFor}>
		{label}{#if required}<span class="field-required" aria-hidden="true">*</span>{/if}
	</label>
	<!--
		`control` is passed to every call, snippet form or not. The plain form's
		implicit snippet takes no parameters and ignores the argument, which is
		what keeps the two APIs interchangeable.
	-->
	{@render children?.(control)}
	{#if error}
		<!--
			`alert` rather than a bare paragraph: this is a message about the field
			the operator is currently on, and it appears the moment they move away
			from it, so it should speak without waiting to be found.
		-->
		<p class="field-error" id={messageId} role="alert">{error}</p>
	{:else if hint}
		<p class="field-hint" id={messageId}>{hint}</p>
	{/if}
</div>

<style>
	/*
	 * The asterisk is `aria-hidden` because the requirement itself is on the
	 * control as `aria-required`, which is the announcement a screen reader can
	 * act on. It is drawn in the danger colour as emphasis, not as the only
	 * carrier of the meaning.
	 */
	.field-required {
		color: var(--danger);
		margin-left: 2px;
	}
</style>
