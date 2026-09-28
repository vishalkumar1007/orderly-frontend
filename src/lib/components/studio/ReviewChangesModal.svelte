<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import Rocket from '@lucide/svelte/icons/rocket';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
	import type { StudioDraftStore } from '$lib/storefront/studioDraft.svelte';

	let {
		store,
		open = $bindable(false),
		onpublish,
		ondiscard
	}: {
		store: StudioDraftStore;
		open?: boolean;
		/**
		 * Publishing and discarding belong to the screen, not to this dialog:
		 * both need a confirmation, a toast and a reload of the shared config,
		 * and a modal that did its own thing was a second place for the outcome
		 * of a publish to be decided.
		 */
		onpublish?: () => void;
		ondiscard?: () => void;
	} = $props();

	const diffs = $derived(store.diffs);
</script>

{#if open}
	<div
		class="review-modal-backdrop"
		onclick={() => (open = false)}
		onkeydown={(e) => e.key === 'Escape' && (open = false)}
		role="presentation"
	>
		<div
			class="review-modal-panel"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
		>
			<div class="review-modal-header">
				<div>
					<h2 class="review-title">Review Draft Changes</h2>
					<p class="review-subtitle">
						Inspect the changes between your working draft and what is live to customers.
					</p>
				</div>
				<button type="button" class="review-close-btn" onclick={() => (open = false)} aria-label="Close">
					<X size={18} strokeWidth={2} />
				</button>
			</div>

			<div class="review-modal-body">
				{#if store.error}
					<div class="review-error">
						<AlertCircle size={16} strokeWidth={2} />
						<span>{store.error}</span>
					</div>
				{/if}

				{#if diffs.length === 0}
					<div class="review-clean-state">
						<CheckCircle2 size={28} strokeWidth={2} />
						<p>Nothing unpublished. What you see in the Studio is what customers see.</p>
					</div>
				{:else}
					<div class="review-summary-bar">
						<span><strong>{diffs.length}</strong> change{diffs.length === 1 ? '' : 's'} to publish</span>
						<span class="review-version-tag">Draft → Live Store</span>
					</div>

					<div class="review-diff-list">
						{#each diffs as diff}
							<div class="review-diff-item">
								<div class="review-diff-meta">
									<span class="review-diff-cat">{diff.category}</span>
									<span class="review-diff-label">{diff.label}</span>
								</div>
								<div class="review-diff-comparison">
									<span class="review-diff-from">{diff.from}</span>
									<ArrowRight size={13} strokeWidth={2.4} class="review-diff-arrow" />
									<span class="review-diff-to">{diff.to}</span>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="review-modal-footer">
				{#if true}
					{#if diffs.length > 0}
						<button
							type="button"
							class="btn btn-ghost btn-sm"
							onclick={() => ondiscard?.()}
							disabled={store.isPublishing}
						>
							<RotateCcw size={14} strokeWidth={2} />
							<span>Discard All Changes</span>
						</button>
					{/if}
					<div style="flex:1;"></div>
					<button
						type="button"
						class="btn btn-secondary btn-sm"
						onclick={() => (open = false)}
						disabled={store.isPublishing}
					>
						Keep Editing
					</button>
					<button
						type="button"
						class="btn btn-primary btn-sm"
						disabled={store.isPublishing || diffs.length === 0}
						onclick={() => onpublish?.()}
					>
						<Rocket size={14} strokeWidth={2.4} />
						<span>{store.isPublishing ? 'Publishing…' : 'Publish Live'}</span>
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.review-modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.65);
		backdrop-filter: blur(4px);
		z-index: 1000;
		display: grid;
		place-items: center;
		padding: 1rem;
	}

	.review-modal-panel {
		width: 100%;
		max-width: 600px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg, 16px);
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.review-modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border);
		background: var(--surface-2);
	}

	.review-title {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
		color: var(--text);
	}

	.review-subtitle {
		margin: 2px 0 0;
		font-size: 0.75rem;
		color: var(--text-3);
	}

	.review-close-btn {
		background: transparent;
		border: none;
		color: var(--text-3);
		cursor: pointer;
		padding: 4px;
		border-radius: 6px;
	}

	.review-close-btn:hover {
		color: var(--text);
		background: var(--surface);
	}

	.review-modal-body {
		padding: 1.25rem;
		max-height: 60vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.review-error {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border-radius: var(--radius-sm, 6px);
		background: color-mix(in srgb, var(--warn, #ef4444) 12%, transparent);
		color: var(--warn, #ef4444);
		font-size: 0.8125rem;
	}




	.review-clean-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 2rem 1rem;
		color: #10b981;
		text-align: center;
		gap: 8px;
		font-size: 0.84375rem;
	}

	.review-summary-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.8125rem;
		color: var(--text-2);
		padding-bottom: 6px;
		border-bottom: 1px solid var(--border);
	}

	.review-version-tag {
		font-size: 0.6875rem;
		font-weight: 700;
		background: var(--surface-3);
		padding: 2px 8px;
		border-radius: 999px;
	}

	.review-diff-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.review-diff-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 8px);
		background: var(--surface-2);
		gap: 12px;
	}

	.review-diff-meta {
		display: flex;
		flex-direction: column;
	}

	.review-diff-cat {
		font-size: 0.65625rem;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--icon-fg);
		letter-spacing: 0.5px;
	}

	.review-diff-label {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text);
	}

	.review-diff-comparison {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.78125rem;
	}

	.review-diff-from {
		color: var(--text-3);
		text-decoration: line-through;
	}

	.review-diff-to {
		font-weight: 700;
		color: #10b981;
	}

	.review-modal-footer {
		display: flex;
		align-items: center;
		padding: 0.875rem 1.25rem;
		border-top: 1px solid var(--border);
		background: var(--surface-2);
		gap: 8px;
	}
</style>
