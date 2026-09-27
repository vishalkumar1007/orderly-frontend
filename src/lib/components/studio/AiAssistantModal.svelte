<script lang="ts">
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import X from '@lucide/svelte/icons/x';
	import Check from '@lucide/svelte/icons/check';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import {
		AI_SUGGESTIONS,
		processAiDesignRequest,
		type AiProposal
	} from '$lib/storefront/aiAssistant';
	import type { StudioDraftStore } from '$lib/storefront/studioDraft.svelte';
	import { cloneConfig } from '$lib/storefront/studioDraft.svelte';
	import type { AdminStorefront } from '$lib/storefront/admin';

	let {
		store,
		isOpen = $bindable(false)
	}: {
		store: StudioDraftStore;
		isOpen: boolean;
	} = $props();

	let promptText = $state('');
	let proposal = $state<AiProposal | null>(null);
	let beforeDraft = $state<AdminStorefront | null>(null);
	let isApplied = $state(false);

	function generate(prompt: string) {
		promptText = prompt;
		if (!prompt.trim()) return;

		// Save checkpoint for undo
		beforeDraft = cloneConfig(store.draft);

		const result = processAiDesignRequest(prompt, store.draft);
		proposal = result;
		isApplied = false;

		// Instantly reflect in draft so right pane live preview shows the proposed changes
		store.mutate((d) => {
			Object.assign(d.theme, result.updatedConfig.theme);
			if (result.updatedConfig.store.business_type) {
				d.store.business_type = result.updatedConfig.store.business_type;
			}
			if (result.updatedConfig.store.tagline) {
				d.store.tagline = result.updatedConfig.store.tagline;
			}
		});
	}

	function applyProposal() {
		if (!proposal) return;
		isApplied = true;
		isOpen = false;
	}

	function undoProposal() {
		if (beforeDraft) {
			store.draft = cloneConfig(beforeDraft);
			store.persistToStorage();
		}
		proposal = null;
		isApplied = false;
	}

	function close() {
		if (proposal && !isApplied) {
			undoProposal();
		}
		isOpen = false;
	}
</script>

{#if isOpen}
	<div
		class="ai-modal-backdrop"
		onclick={close}
		onkeydown={(e) => e.key === 'Escape' && close()}
		role="presentation"
	>
		<div class="ai-modal-panel" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
			<div class="ai-modal-header">
				<div class="ai-title-wrap">
					<span class="ai-sparkle-badge">
						<Sparkles size={16} strokeWidth={2.4} />
					</span>
					<div>
						<h2 class="ai-title">AI Design Assistant</h2>
						<p class="ai-subtitle">
							Modifies only controlled design tokens. Live preview updates instantly.
						</p>
					</div>
				</div>
				<button type="button" class="ai-close-btn" onclick={close} aria-label="Close">
					<X size={18} strokeWidth={2} />
				</button>
			</div>

			<div class="ai-modal-body">
				<!-- Prompt Input -->
				<div class="ai-input-box">
					<input
						type="text"
						class="ai-input"
						placeholder="e.g. Make my store modern and premium with Indigo..."
						bind:value={promptText}
						onkeydown={(e) => e.key === 'Enter' && generate(promptText)}
					/>
					<button
						type="button"
						class="ai-generate-btn"
						disabled={!promptText.trim()}
						onclick={() => generate(promptText)}
					>
						<Sparkles size={14} strokeWidth={2.2} />
						<span>Generate</span>
					</button>
				</div>

				<!-- Quick Chips -->
				<div class="ai-suggestions-wrap">
					<span class="ai-suggestions-label">Try these popular styling requests:</span>
					<div class="ai-chips">
						{#each AI_SUGGESTIONS as sug}
							<button
								type="button"
								class="ai-chip"
								onclick={() => generate(sug)}
							>
								{sug}
							</button>
						{/each}
					</div>
				</div>

				<!-- Proposed Changes Breakdown -->
				{#if proposal}
					<div class="ai-proposal-card">
						<div class="ai-proposal-head">
							<span class="ai-proposal-title">Changes Made by AI</span>
							<span class="ai-proposal-badge">
								{proposal.changes.length} Token{proposal.changes.length === 1 ? '' : 's'} Updated
							</span>
						</div>

						<p class="ai-proposal-summary">{proposal.summary}</p>

						<div class="ai-changes-list">
							{#each proposal.changes as change}
								<div class="ai-change-row">
									<span class="ai-change-field">{change.field}:</span>
									<span class="ai-change-from">{change.from}</span>
									<ArrowRight size={13} strokeWidth={2.2} class="ai-arrow" />
									<span class="ai-change-to">{change.to}</span>
								</div>
							{/each}
						</div>

						<div class="ai-proposal-actions">
							<button type="button" class="btn btn-secondary btn-sm" onclick={undoProposal}>
								<RotateCcw size={14} strokeWidth={2} />
								<span>Undo</span>
							</button>
							<button type="button" class="btn btn-primary btn-sm" onclick={applyProposal}>
								<Check size={14} strokeWidth={2.5} />
								<span>Apply Changes</span>
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.ai-modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.6);
		backdrop-filter: blur(4px);
		z-index: 1000;
		display: grid;
		place-items: center;
		padding: 1rem;
	}

	.ai-modal-panel {
		width: 100%;
		max-width: 580px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg, 16px);
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.ai-modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border);
		background: var(--surface-2);
	}

	.ai-title-wrap {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.ai-sparkle-badge {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: linear-gradient(135deg, #6366f1, #a855f7);
		color: #ffffff;
		display: grid;
		place-items: center;
	}

	.ai-title {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
		color: var(--text);
	}

	.ai-subtitle {
		margin: 2px 0 0;
		font-size: 0.75rem;
		color: var(--text-3);
	}

	.ai-close-btn {
		background: transparent;
		border: none;
		color: var(--text-3);
		cursor: pointer;
		padding: 4px;
		border-radius: 6px;
	}

	.ai-close-btn:hover {
		color: var(--text);
		background: var(--surface);
	}

	.ai-modal-body {
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-height: 80vh;
		overflow-y: auto;
	}

	.ai-input-box {
		display: flex;
		gap: 8px;
	}

	.ai-input {
		flex: 1;
		padding: 8px 12px;
		font-size: 0.875rem;
		border: 1.5px solid var(--border);
		border-radius: var(--radius-sm, 8px);
		background: var(--surface);
		color: var(--text);
	}

	.ai-input:focus {
		outline: none;
		border-color: #6366f1;
		box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
	}

	.ai-generate-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		font-size: 0.8125rem;
		font-weight: 700;
		background: linear-gradient(135deg, #6366f1, #8b5cf6);
		color: #ffffff;
		border: none;
		border-radius: var(--radius-sm, 8px);
		cursor: pointer;
		transition: opacity 0.15s ease;
	}

	.ai-generate-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.ai-suggestions-wrap {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.ai-suggestions-label {
		font-size: 0.71875rem;
		font-weight: 600;
		color: var(--text-3);
	}

	.ai-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.ai-chip {
		font-size: 0.71875rem;
		padding: 5px 10px;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--surface-2);
		color: var(--text-2);
		cursor: pointer;
		text-align: left;
		transition: all 0.15s ease;
	}

	.ai-chip:hover {
		border-color: #6366f1;
		color: var(--text);
		background: color-mix(in srgb, #6366f1 10%, var(--surface));
	}

	.ai-proposal-card {
		padding: 12px 14px;
		border-radius: var(--radius-sm, 10px);
		background: color-mix(in srgb, #6366f1 8%, var(--surface));
		border: 1.5px solid color-mix(in srgb, #6366f1 30%, var(--border));
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.ai-proposal-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.ai-proposal-title {
		font-size: 0.84375rem;
		font-weight: 700;
		color: var(--text);
	}

	.ai-proposal-badge {
		font-size: 0.6875rem;
		font-weight: 700;
		background: #6366f1;
		color: #ffffff;
		padding: 2px 8px;
		border-radius: 999px;
	}

	.ai-proposal-summary {
		margin: 0;
		font-size: 0.78125rem;
		color: var(--text-2);
		line-height: 1.4;
	}

	.ai-changes-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 4px;
	}

	.ai-change-row {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.75rem;
	}

	.ai-change-field {
		font-weight: 600;
		color: var(--text);
	}

	.ai-change-from {
		color: var(--text-3);
		text-decoration: line-through;
	}

	.ai-change-to {
		font-weight: 600;
		color: #10b981;
	}

	.ai-proposal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 6px;
	}
</style>
