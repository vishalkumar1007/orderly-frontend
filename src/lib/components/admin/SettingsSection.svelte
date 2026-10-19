<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { IconComponent } from '$lib/icons';
	import IconCheck from '@tabler/icons-svelte/icons/check';

	/**
	 * One settings block: title and description on top, full-width form card below.
	 *
	 * Stacked (not side-by-side) so the form owns the content width and the
	 * explanation stays readable without stealing a fixed left column. Each
	 * section still saves its own scope: the footer sits with the fields it
	 * writes and can say whether there is anything to write.
	 */
	let {
		title,
		description = '',
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
		icon?: IconComponent;
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

	// `icon` stays in the prop type so existing call sites compile, but sections no
	// longer draw one: an icon beside every heading is decoration, not wayfinding.
</script>

<section class="set-section">
	<header class="set-head">
		<h2>{title}</h2>
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
							<IconCheck size={13} stroke={2} />
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
		gap: var(--sp-5);
	}

	.set-head h2 {
		margin: 0;
		font-size: var(--fs-body);
		font-weight: 600;
		color: var(--text);
	}

	.set-head p {
		margin: var(--sp-2) 0 0;
		font-size: var(--fs-tab);
		line-height: 1.5;
		color: var(--text-3);
		max-width: 40rem;
	}

	.set-body {
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--card-bg);
		overflow: hidden;
		min-width: 0;
		width: 100%;
	}

	.set-fields {
		display: flex;
		flex-direction: column;
		gap: var(--sp-7);
		padding: var(--sp-9) var(--sp-10);
	}

	/* A toggle reads label-left, switch-right, like every settings screen people know. */
	.set-fields :global(.switch) {
		width: 100%;
		flex-direction: row-reverse;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--sp-10);
	}

	.set-foot {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: var(--sp-4);
		padding: var(--sp-5) var(--sp-10);
		border-top: 1px solid var(--border-subtle);
	}

	.set-state {
		margin-right: auto;
		font-size: var(--fs-meta);
		color: var(--text-3);
	}

	.set-saved {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		color: var(--success);
		font-weight: 600;
	}
</style>
