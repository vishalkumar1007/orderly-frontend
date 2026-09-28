<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import Check from '@lucide/svelte/icons/check';

	/**
	 * One settings block: title and description on top, full-width form card below.
	 *
	 * Stacked (not side-by-side) so the form owns the content width and the
	 * explanation stays readable without stealing a fixed left column. Each
	 * section still saves its own scope — the footer sits with the fields it
	 * writes and can say whether there is anything to write.
	 */
	let {
		title,
		description = '',
		icon,
		/** Disables the save button until something actually changed. */
		dirty = false,
		saving = false,
		/** Shows a transient confirmation after a successful save. */
		saved = false,
		saveLabel = 'Save changes',
		onsave,
		onreset,
		children,
		footer
	}: {
		title: string;
		description?: string;
		icon?: Component;
		dirty?: boolean;
		saving?: boolean;
		saved?: boolean;
		saveLabel?: string;
		onsave?: () => void;
		onreset?: () => void;
		children: Snippet;
		/** Replaces the default save row entirely, for sections that self-save. */
		footer?: Snippet;
	} = $props();

	const Icon = $derived(icon);
</script>

<section class="set-section">
	<header class="set-head">
		<h2>
			{#if Icon}
				<span class="set-icon"><Icon size={15} strokeWidth={1.9} /></span>
			{/if}
			{title}
		</h2>
		{#if description}<p>{description}</p>{/if}
	</header>

	<div class="set-body">
		<div class="set-fields">
			{@render children()}
		</div>

		{#if footer}
			<div class="set-foot">{@render footer()}</div>
		{:else if onsave}
			<div class="set-foot">
				<span class="set-state" aria-live="polite">
					{#if saving}
						Saving…
					{:else if saved}
						<span class="set-saved">
							<Check size={13} strokeWidth={2.6} />
							Saved
						</span>
					{:else if dirty}
						Unsaved changes
					{/if}
				</span>
				{#if dirty && onreset}
					<button type="button" class="btn btn-quiet btn-sm" disabled={saving} onclick={onreset}>
						Discard
					</button>
				{/if}
				<button
					type="button"
					class="btn btn-primary btn-sm"
					disabled={saving || !dirty}
					onclick={onsave}
				>
					{saving ? 'Saving…' : saveLabel}
				</button>
			</div>
		{/if}
	</div>
</section>

<style>
	.set-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.75rem 0;
		border-top: 1px solid var(--border-subtle);
	}

	.set-section:first-of-type {
		border-top: 0;
		padding-top: 0;
	}

	.set-head h2 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		font-family: var(--font-display);
		font-size: 0.95rem;
		font-weight: 600;
		letter-spacing: -0.015em;
		color: var(--text);
	}

	.set-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: var(--radius-sm);
		background: var(--surface-3);
		color: var(--icon-fg);
		flex-shrink: 0;
	}

	.set-head p {
		margin: 0.35rem 0 0;
		font-size: 0.8rem;
		line-height: 1.55;
		color: var(--text-3);
		max-width: 40rem;
	}

	.set-body {
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		box-shadow: var(--shadow-sm);
		overflow: hidden;
		min-width: 0;
		width: 100%;
	}

	.set-fields {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		padding: 1.25rem 1.35rem;
	}

	.set-foot {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: 0.55rem;
		padding: 0.7rem 1.35rem;
		background: var(--surface-2);
		border-top: 1px solid var(--border-subtle);
	}

	.set-state {
		margin-right: auto;
		font-size: 0.76rem;
		color: var(--text-3);
	}

	.set-saved {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--success);
		font-weight: 600;
	}
</style>
