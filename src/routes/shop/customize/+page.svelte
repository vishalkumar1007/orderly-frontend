<script lang="ts">
	import { onMount } from 'svelte';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Rocket from '@lucide/svelte/icons/rocket';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Save from '@lucide/svelte/icons/save';
	import FileDiff from '@lucide/svelte/icons/file-diff';
	import { useStorefront, type StorefrontContext } from '$lib/storefront/admin-context';
	import { StudioDraftStore } from '$lib/storefront/studioDraft.svelte';
	import StudioControls from '$lib/components/studio/StudioControls.svelte';
	import StudioPreview from '$lib/components/studio/StudioPreview.svelte';
	import AiAssistantModal from '$lib/components/studio/AiAssistantModal.svelte';
	import ReviewChangesModal from '$lib/components/studio/ReviewChangesModal.svelte';
	import { toast } from '$lib/components/admin/toast';

	let props: Partial<StorefrontContext> = $props();
	const ctx = useStorefront(() => props);

	let store = $state<StudioDraftStore>(new StudioDraftStore(ctx.config));
	let showAiModal = $state(false);
	let showReviewModal = $state(false);
	let saveDraftSuccess = $state(false);

	// Sync when server config loads
	$effect(() => {
		if (ctx.config && (!store || store.published.store.slug !== ctx.config.store.slug)) {
			store.init(ctx.config);
		}
	});

	function handleUndo() {
		const ok = store.undo();
		if (ok) {
			toast.info('Undid last change');
		}
	}

	function handleManualSaveDraft() {
		store.persistToStorage();
		saveDraftSuccess = true;
		toast.success('Draft saved to browser storage');
		setTimeout(() => {
			saveDraftSuccess = false;
		}, 2000);
	}

	async function handleDirectPublish() {
		const ok = await store.publish();
		if (ok) {
			toast.success('Storefront published live successfully!');
		} else if (store.error) {
			toast.error(store.error);
		}
	}

	const isDirty = $derived(store.isDirty);
	const diffCount = $derived(store.diffs.length);
</script>

<svelte:head>
	<title>Storefront Studio | Orderly</title>
</svelte:head>

<div class="storefront-studio-workspace">
	<!-- Main Studio Header Bar -->
	<header class="studio-header-bar">
		<div class="studio-header-left">
			<div class="studio-title-badge-group">
				<h1 class="studio-heading">Storefront Studio</h1>
				{#if isDirty}
					<span class="studio-badge badge-draft">
						<span class="studio-pulse-dot"></span>
						Draft ({diffCount} change{diffCount === 1 ? '' : 's'})
					</span>
				{:else}
					<span class="studio-badge badge-live">
						<CheckCircle2 size={13} strokeWidth={2.4} />
						Published Live
					</span>
				{/if}

				{#if store.lastSavedTimestamp}
					<span class="studio-last-saved">
						Autosaved {store.lastSavedTimestamp}
					</span>
				{/if}
			</div>

			<p class="studio-subtitle">
				Split-screen customization workspace. Changes update preview immediately.
			</p>
		</div>

		<div class="studio-header-actions">
			<!-- AI Design Assistant Action -->
			<button
				type="button"
				class="btn btn-ai-assistant"
				onclick={() => (showAiModal = true)}
				title="Open AI Design Assistant"
			>
				<Sparkles size={15} strokeWidth={2.2} />
				<span>Ask AI</span>
			</button>

			<!-- Undo Action -->
			<button
				type="button"
				class="btn btn-ghost btn-sm"
				disabled={store.history.length === 0}
				onclick={handleUndo}
				title="Undo last change"
			>
				<RotateCcw size={14} strokeWidth={2} />
				<span>Undo</span>
			</button>

			<!-- Review Changes Action -->
			<button
				type="button"
				class="btn btn-secondary btn-sm"
				onclick={() => (showReviewModal = true)}
				title="Review diff before publishing"
			>
				<FileDiff size={14} strokeWidth={2} />
				<span>Review{diffCount > 0 ? ` (${diffCount})` : ''}</span>
			</button>

			<!-- Save Draft Action -->
			<button
				type="button"
				class="btn btn-ghost btn-sm"
				onclick={handleManualSaveDraft}
				title="Save draft"
			>
				<Save size={14} strokeWidth={2} />
				<span>Save Draft</span>
			</button>

			<!-- Publish Live Action -->
			<button
				type="button"
				class="btn btn-primary btn-sm btn-publish"
				disabled={store.isPublishing}
				onclick={handleDirectPublish}
			>
				<Rocket size={14} strokeWidth={2.4} />
				<span>{store.isPublishing ? 'Publishing…' : 'Publish'}</span>
			</button>
		</div>
	</header>

	<!-- Split-Screen Studio Body -->
	<div class="studio-split-screen">
		<!-- Left: Customization Controls -->
		<aside class="studio-controls-pane">
			{#if store.draft}
				<StudioControls {store} />
			{/if}
		</aside>

		<!-- Right: Real Live Storefront Preview -->
		<main class="studio-preview-wrapper">
			{#if store.draft}
				<StudioPreview config={store.draft} />
			{/if}
		</main>
	</div>
</div>

<!-- AI Design Assistant Modal -->
<AiAssistantModal {store} bind:isOpen={showAiModal} />

<!-- Review & Publish Changes Modal -->
<ReviewChangesModal {store} bind:isOpen={showReviewModal} />

<style>
	.storefront-studio-workspace {
		display: flex;
		flex-direction: column;
		height: calc(100dvh - var(--topbar-h, 54px));
		background: var(--surface);
		overflow: hidden;
		margin: -1.25rem -1.25rem -1.5rem; /* Break out of default padding */
	}

	.studio-header-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1.25rem;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		gap: 1rem;
		flex-wrap: wrap;
		z-index: 20;
	}

	.studio-header-left {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.studio-title-badge-group {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.studio-heading {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--text);
		letter-spacing: -0.2px;
	}

	.studio-subtitle {
		margin: 0;
		font-size: 0.75rem;
		color: var(--text-3);
	}

	.studio-badge {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 2px 8px;
		border-radius: 999px;
		font-size: 0.6875rem;
		font-weight: 700;
	}

	.badge-live {
		background: color-mix(in srgb, #10b981 12%, transparent);
		color: #10b981;
		border: 1px solid color-mix(in srgb, #10b981 30%, transparent);
	}

	.badge-draft {
		background: color-mix(in srgb, #f59e0b 14%, transparent);
		color: #f59e0b;
		border: 1px solid color-mix(in srgb, #f59e0b 35%, transparent);
	}

	.studio-pulse-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #f59e0b;
		box-shadow: 0 0 6px #f59e0b;
		animation: pulse-ring 1.8s infinite;
	}

	@keyframes pulse-ring {
		0% {
			transform: scale(0.9);
			opacity: 1;
		}
		50% {
			transform: scale(1.3);
			opacity: 0.6;
		}
		100% {
			transform: scale(0.9);
			opacity: 1;
		}
	}

	.studio-last-saved {
		font-size: 0.6875rem;
		color: var(--text-3);
	}

	.studio-header-actions {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}

	.btn-ai-assistant {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		font-size: 0.8125rem;
		font-weight: 700;
		background: linear-gradient(135deg, #6366f1, #8b5cf6);
		color: #ffffff;
		border: none;
		border-radius: var(--radius-sm, 6px);
		cursor: pointer;
		box-shadow: 0 2px 6px rgba(99, 102, 241, 0.25);
		transition: all 0.15s ease;
	}

	.btn-ai-assistant:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
	}

	.btn-publish {
		background: var(--accent);
		color: #ffffff;
		font-weight: 700;
	}

	.studio-split-screen {
		display: grid;
		grid-template-columns: minmax(360px, 460px) 1fr;
		flex: 1;
		height: calc(100% - 58px);
		overflow: hidden;
	}

	@media (max-width: 900px) {
		.studio-split-screen {
			grid-template-columns: 1fr;
			overflow-y: auto;
		}
	}

	.studio-controls-pane {
		height: 100%;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.studio-preview-wrapper {
		height: 100%;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
</style>
