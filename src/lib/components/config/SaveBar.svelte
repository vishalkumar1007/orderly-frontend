<script lang="ts">
	/**
	 * Appears only while there are unsaved changes, pinned to the bottom of the
	 * view, so Save is always one glance away and never forgotten below the fold.
	 */
	import { fly } from 'svelte/transition';

	let {
		dirty,
		saving = false,
		message = 'You have unsaved changes',
		saveLabel = 'Save changes',
		disabled = false,
		ondiscard,
		onsave
	}: {
		dirty: boolean;
		saving?: boolean;
		message?: string;
		saveLabel?: string;
		/** Blocks saving (e.g. an invalid combination) while still showing the bar. */
		disabled?: boolean;
		ondiscard: () => void;
		onsave: () => void;
	} = $props();
</script>

{#if dirty}
	<div class="sb" role="region" aria-label="Unsaved changes" transition:fly={{ y: 16, duration: 160 }}>
		<span class="sb-msg"><span class="sb-dot" aria-hidden="true"></span>{message}</span>
		<span class="sb-actions">
			<button type="button" class="btn btn-ghost btn-sm" disabled={saving} onclick={ondiscard}>Discard</button>
			<button type="button" class="btn btn-primary btn-sm" disabled={saving || disabled} onclick={onsave}>
				{saving ? 'Saving...' : saveLabel}
			</button>
		</span>
	</div>
{/if}

<style>
	.sb {
		position: sticky;
		bottom: var(--sp-8);
		z-index: 5;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-8);
		flex-wrap: wrap;
		margin-top: var(--sp-8);
		padding: var(--sp-6) var(--sp-6) var(--sp-6) var(--sp-9);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--card-bg, var(--surface));
		box-shadow: var(--shadow-md);
	}

	.sb-msg {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-4);
		font-size: var(--fs-tab);
		font-weight: 600;
		color: var(--text);
	}

	.sb-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--warn);
	}

	.sb-actions {
		display: flex;
		gap: var(--sp-4);
	}
</style>
