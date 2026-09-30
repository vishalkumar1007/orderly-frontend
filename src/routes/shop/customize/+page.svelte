<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CloudOff from '@lucide/svelte/icons/cloud-off';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import FileDiff from '@lucide/svelte/icons/file-diff';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Upload from '@lucide/svelte/icons/upload';
	import { templateFor } from '$lib/admin/businessTypes';
	import { useStorefront, type StorefrontContext } from '$lib/storefront/admin-context';
	import { StudioDraftStore } from '$lib/storefront/studioDraft.svelte';
	import {
		studioSectionFor,
		visibleStudioSections
	} from '$lib/storefront/studioSections';
	import StudioControls from '$lib/components/studio/StudioControls.svelte';
	import StudioPreview from '$lib/components/studio/StudioPreview.svelte';
	import AiAssistantModal from '$lib/components/studio/AiAssistantModal.svelte';
	import ReviewChangesModal from '$lib/components/studio/ReviewChangesModal.svelte';
	import ConfirmDialog from '$lib/components/admin/ConfirmDialog.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import { toast } from '$lib/components/admin/toast';

	/**
	 * Storefront Studio.
	 *
	 * Three columns, which is the whole idea: what you can change, what you are
	 * changing, and what it will look like. The sections used to be a row of
	 * tabs inside the control panel inside the page — three levels of navigation
	 * for one screen — and the header carried six equally-weighted buttons, so
	 * nothing read as the thing you came to do.
	 *
	 * The section rail names itself after the business type. A hotel does not
	 * have a "Menu", and a console that insists it does was built for somebody
	 * else's shop.
	 *
	 * Draft state is the server's answer, never a guess: "Saved", "Saving" and
	 * "Unpublished changes" all come from the draft endpoint, and the one
	 * emphasised action is Publish.
	 */
	let props: Partial<StorefrontContext> = $props();
	const ctx = useStorefront(() => props);

	const store = new StudioDraftStore(ctx.config);
	let showAi = $state(false);
	let showReview = $state(false);
	let discardOpen = $state(false);
	let conflictOpen = $state(false);
	let discarding = $state(false);

	/** Reload the draft whenever the shell hands us a different shop. */
	let loadedSlug = $state('');
	$effect(() => {
		const slug = ctx.config?.store?.slug ?? '';
		if (!slug || slug === loadedSlug) return;
		loadedSlug = slug;
		untrack(() => void store.load(ctx.config));
	});

	onMount(() => {
		// A draft that only exists on the server is worth flushing before the
		// tab closes; the debounce may still be holding the last keystroke.
		const flush = () => void store.saveNow();
		window.addEventListener('beforeunload', flush);
		return () => window.removeEventListener('beforeunload', flush);
	});

	const template = $derived(templateFor(ctx.config?.store?.business_type ?? ''));
	const terms = $derived(template.terminology);
	const controls = $derived(template.controls);
	const allowed = $derived(new Set(controls));
	const sections = $derived(visibleStudioSections(controls));
	const active = $derived(studioSectionFor($page.url.searchParams.get('section'), controls));

	const counts = $derived(store.diffsByCategory);
	const changeCount = $derived(store.diffs.length);
	const isDirty = $derived(changeCount > 0);

	function countFor(categories: string[]): number {
		return categories.reduce((sum, c) => sum + (counts[c] ?? 0), 0);
	}

	function select(id: string) {
		goto(`?section=${id}`, { replaceState: true, keepFocus: true, noScroll: true });
	}

	/** "Saved 2 min ago" beats a bare timestamp for something that just happened. */
	const savedLabel = $derived.by(() => {
		if (store.isSaving) return 'Saving…';
		if (!store.savedAt) return '';
		const then = new Date(store.savedAt).getTime();
		if (Number.isNaN(then)) return 'Saved';
		const mins = Math.floor((Date.now() - then) / 60000);
		if (mins < 1) return 'Saved just now';
		if (mins === 1) return 'Saved 1 min ago';
		if (mins < 60) return `Saved ${mins} min ago`;
		return `Saved ${new Date(store.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
	});

	async function publish(force = false) {
		const result = await store.publish(force);
		if (result === 'published') {
			showReview = false;
			conflictOpen = false;
			toast.success('Your storefront is live');
			await ctx.refresh();
		} else if (result === 'conflict') {
			showReview = false;
			conflictOpen = true;
		} else {
			toast.error(store.error || 'Could not publish your changes');
		}
	}

	async function discard() {
		discarding = true;
		const ok = await store.discard();
		discarding = false;
		discardOpen = false;
		if (ok) {
			toast.success('Draft discarded');
			await ctx.refresh();
		} else {
			toast.error(store.error || 'Could not discard your draft');
		}
	}

	function undo() {
		if (store.undo()) toast.info('Undid last change');
	}
</script>

<svelte:head>
	<title>Storefront Studio · Orderly</title>
</svelte:head>

<div class="studio">
	<header class="studio-bar">
		<div class="studio-bar-left">
			<a class="btn btn-ghost btn-sm" href="/shop" aria-label="Back to the console">
				<ArrowLeft size={15} strokeWidth={2} />
			</a>
			<div class="studio-id">
				<h1>Storefront Studio</h1>
				<p>{template.label} · {ctx.config?.store?.name ?? ''}</p>
			</div>
		</div>

		<div class="studio-state" role="status" aria-live="polite">
			{#if store.isLoading}
				<span class="studio-chip">Loading…</span>
			{:else if store.isStale}
				<span class="studio-chip chip-warn">
					<TriangleAlert size={13} strokeWidth={2.2} />
					Storefront changed elsewhere
				</span>
			{:else if isDirty}
				<span class="studio-chip chip-draft">
					<span class="studio-dot"></span>
					{changeCount} unpublished {changeCount === 1 ? 'change' : 'changes'}
				</span>
			{:else}
				<span class="studio-chip chip-live">
					<CircleCheck size={13} strokeWidth={2.4} />
					Everything published
				</span>
			{/if}

			{#if savedLabel}
				<span class="studio-saved">
					{#if store.error}
						<CloudOff size={12} strokeWidth={2} />
					{/if}
					{savedLabel}{store.savedBy ? ` · ${store.savedBy}` : ''}
				</span>
			{/if}
		</div>

		<div class="studio-actions">
			<button
				class="btn btn-ghost btn-sm"
				type="button"
				onclick={() => (showAi = true)}
				title="Ask the design assistant"
			>
				<Sparkles size={14} strokeWidth={2.1} />
				<span class="studio-action-label">Ask AI</span>
			</button>
			<button
				class="btn btn-ghost btn-sm"
				type="button"
				disabled={store.history.length === 0}
				onclick={undo}
				title="Undo the last change"
			>
				<RotateCcw size={14} strokeWidth={2} />
			</button>
			<button
				class="btn btn-ghost btn-sm"
				type="button"
				disabled={!isDirty}
				onclick={() => (discardOpen = true)}
				title="Discard the draft"
			>
				<Trash2 size={14} strokeWidth={2} />
			</button>
			<button
				class="btn btn-secondary btn-sm"
				type="button"
				disabled={!isDirty}
				onclick={() => (showReview = true)}
			>
				<FileDiff size={14} strokeWidth={2} />
				<span class="studio-action-label">Review</span>
				{#if isDirty}<span class="studio-count">{changeCount}</span>{/if}
			</button>
			<button
				class="btn btn-primary btn-sm"
				type="button"
				disabled={!isDirty || store.isPublishing}
				onclick={() => void publish()}
			>
				<Upload size={14} strokeWidth={2.1} />
				{store.isPublishing ? 'Publishing…' : 'Publish'}
			</button>
			{#if ctx.config?.public_url}
				<a
					class="btn btn-ghost btn-sm"
					href={ctx.config.public_url}
					target="_blank"
					rel="noopener"
					title="Open the live storefront"
				>
					<ExternalLink size={14} strokeWidth={2} />
				</a>
			{/if}
		</div>
	</header>

	<div class="studio-body">
		<nav class="studio-rail" aria-label="Studio sections">
			{#each sections as section (section.id)}
				{@const on = active.id === section.id}
				{@const n = countFor(section.categories)}
				<button
					type="button"
					class="studio-rail-item"
					class:on
					aria-current={on ? 'page' : undefined}
					onclick={() => select(section.id)}
				>
					<span class="studio-rail-icon"><section.icon size={16} strokeWidth={1.9} /></span>
					<span class="studio-rail-text">
						<span class="studio-rail-label">{section.label(terms)}</span>
						<span class="studio-rail-hint">{section.hint(terms)}</span>
					</span>
					{#if n > 0}<span class="studio-rail-count" title="{n} unpublished">{n}</span>{/if}
				</button>
			{/each}
		</nav>

		<section class="studio-panel" aria-label="{active.label(terms)} controls">
			{#if store.isLoading}
				<div class="studio-loading">
					<Skeleton height="1.1rem" width="9rem" />
					<Skeleton height="4rem" />
					<Skeleton height="4rem" />
					<Skeleton height="4rem" />
				</div>
			{:else}
				<StudioControls {store} section={active.id} {terms} {allowed} />
			{/if}
		</section>

		<section class="studio-stage" aria-label="Live preview">
			<StudioPreview config={store.draft} />
		</section>
	</div>
</div>

<AiAssistantModal bind:open={showAi} {store} />
<ReviewChangesModal
	bind:open={showReview}
	{store}
	onpublish={() => void publish()}
	ondiscard={() => {
		showReview = false;
		discardOpen = true;
	}}
/>

<ConfirmDialog
	bind:open={discardOpen}
	title="Discard this draft?"
	message="Everything unpublished goes, and your storefront stays exactly as customers see it now. This cannot be undone."
	confirmLabel="Discard draft"
	danger
	loading={discarding}
	onconfirm={discard}
/>

<ConfirmDialog
	bind:open={conflictOpen}
	title="Your storefront changed elsewhere"
	message="Somebody has edited this storefront since you started. Publishing now replaces their changes with yours. Open the live site in a new tab to compare before you decide."
	confirmLabel="Publish mine anyway"
	danger
	loading={store.isPublishing}
	onconfirm={() => void publish(true)}
/>

<style>
	.studio {
		display: flex;
		flex-direction: column;
		/* Fill the shell's content area: a studio is a workspace, not a page you
		   scroll as a whole — each column scrolls on its own. */
		height: calc(100dvh - var(--topbar-h) - 2.5rem);
		min-height: 34rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		overflow: hidden;
	}

	.studio-bar {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.6rem 0.75rem;
		border-bottom: 1px solid var(--border);
		background: var(--surface-2);
		flex: none;
		flex-wrap: wrap;
	}

	.studio-bar-left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.studio-id h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-title);
		font-weight: 650;
		letter-spacing: -0.01em;
		white-space: nowrap;
	}

	.studio-id p {
		margin: 0;
		font-size: var(--fs-meta);
		color: var(--text-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.studio-state {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-inline: auto;
	}

	.studio-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.25rem 0.55rem;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--surface);
		font-size: var(--fs-meta);
		font-weight: 600;
		color: var(--text-2);
		white-space: nowrap;
	}

	.chip-live {
		color: var(--success);
		border-color: color-mix(in srgb, var(--success) 30%, transparent);
		background: var(--success-bg);
	}

	.chip-draft {
		color: var(--warn);
		border-color: color-mix(in srgb, var(--warn) 30%, transparent);
		background: var(--warn-bg);
	}

	.chip-warn {
		color: var(--danger);
		border-color: color-mix(in srgb, var(--danger) 30%, transparent);
		background: var(--danger-bg);
	}

	.studio-dot {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 999px;
		background: currentColor;
	}

	.studio-saved {
		font-size: var(--fs-label);
		color: var(--text-3);
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		white-space: nowrap;
	}

	.studio-actions {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		flex-wrap: wrap;
	}

	.studio-count {
		display: inline-grid;
		place-items: center;
		min-width: 1.05rem;
		height: 1.05rem;
		padding: 0 0.25rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--text) 12%, transparent);
		font-size: var(--fs-micro);
		font-weight: 700;
	}

	.studio-body {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 14rem minmax(0, 22rem) minmax(0, 1fr);
	}

	.studio-rail {
		border-right: 1px solid var(--border);
		padding: 0.6rem;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		overflow-y: auto;
		background: var(--surface-2);
	}

	.studio-rail-item {
		display: flex;
		align-items: flex-start;
		gap: 0.55rem;
		width: 100%;
		padding: 0.55rem 0.6rem;
		border: 1px solid transparent;
		border-radius: 10px;
		background: transparent;
		color: var(--text-2);
		font-family: inherit;
		text-align: left;
		cursor: pointer;
		transition: background var(--tr), color var(--tr);
	}

	.studio-rail-item:hover {
		background: var(--surface-3);
		color: var(--text);
	}

	.studio-rail-item.on {
		background: color-mix(in srgb, var(--accent) 12%, transparent);
		color: var(--text);
	}

	.studio-rail-icon {
		flex: none;
		margin-top: 0.1rem;
		color: var(--icon-fg);
	}

	.studio-rail-item.on .studio-rail-icon {
		color: var(--accent-dark);
	}

	.studio-rail-text {
		flex: 1;
		min-width: 0;
	}

	.studio-rail-label {
		display: block;
		font-size: var(--fs-body);
		font-weight: 600;
		color: var(--text);
	}

	.studio-rail-hint {
		display: block;
		font-size: var(--fs-label);
		color: var(--text-3);
		line-height: 1.35;
	}

	.studio-rail-count {
		flex: none;
		display: grid;
		place-items: center;
		min-width: 1.15rem;
		height: 1.15rem;
		padding: 0 0.3rem;
		border-radius: 999px;
		background: var(--warn-bg);
		color: var(--warn);
		font-size: var(--fs-micro);
		font-weight: 700;
	}

	.studio-panel {
		border-right: 1px solid var(--border);
		overflow-y: auto;
		padding: 0.9rem;
	}

	.studio-loading {
		display: grid;
		gap: 0.7rem;
	}

	.studio-stage {
		overflow-y: auto;
		background: var(--surface-3);
		padding: 1rem;
	}

	/* —— Narrower: the preview drops under the controls, the rail becomes a
	   scrolling row. A three-column workspace below ~1200px is three columns
	   of nothing. —— */
	@media (max-width: 1200px) {
		.studio {
			height: auto;
			min-height: 0;
		}

		.studio-body {
			grid-template-columns: minmax(0, 1fr);
		}

		.studio-rail {
			flex-direction: row;
			overflow-x: auto;
			border-right: 0;
			border-bottom: 1px solid var(--border);
		}

		.studio-rail-item {
			width: auto;
			white-space: nowrap;
		}

		.studio-rail-hint {
			display: none;
		}

		.studio-panel {
			border-right: 0;
			border-bottom: 1px solid var(--border);
		}
	}

	@media (max-width: 720px) {
		.studio-state {
			order: 3;
			width: 100%;
			margin-inline: 0;
		}

		.studio-action-label {
			display: none;
		}
	}
</style>
