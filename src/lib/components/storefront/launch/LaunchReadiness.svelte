<script lang="ts">
	import type { SetupStepKey } from '$lib/tenant/dashboardCache.svelte';
	import Rocket from '@lucide/svelte/icons/rocket';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleDashed from '@lucide/svelte/icons/circle-dashed';
	import AlertCircle from '@lucide/svelte/icons/circle-alert';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import QrCode from '@lucide/svelte/icons/qr-code';
	import Share2 from '@lucide/svelte/icons/share-2';
	import Copy from '@lucide/svelte/icons/copy';
	import Check from '@lucide/svelte/icons/check';
	import ShieldAlert from '@lucide/svelte/icons/shield-alert';
	import Lock from '@lucide/svelte/icons/lock';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import StatusBadge from '$lib/components/admin/StatusBadge.svelte';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';
	import type { PolicySignature } from '$lib/tenant/policyStore';
	import type { Setup, TabKey } from './types';
	import './launch-shared.css';

	type Step = {
		key: string;
		label: string;
		hint: string;
		href: string;
		isTab?: boolean;
		tab?: TabKey;
		optional?: boolean;
	};

	let {
		setup,
		storefrontUrl,
		loading,
		error,
		busy,
		policySigned,
		policySignature,
		progress,
		done,
		countable,
		canPublish,
		missing,
		STEPS,
		copiedLink,
		onPublish,
		onUnpublish,
		onSetTab,
		onCopyLink,
		onShare,
		onRetry,
		stepLabel
	}: {
		setup: Setup | null;
		storefrontUrl: string;
		loading: boolean;
		error: string;
		busy: boolean;
		policySigned: boolean;
		policySignature: PolicySignature | null;
		progress: number;
		done: number;
		countable: Step[];
		canPublish: boolean;
		missing: string[];
		STEPS: Step[];
		copiedLink: boolean;
		onPublish: () => void;
		onUnpublish: () => void;
		onSetTab: (tab: TabKey) => void;
		onCopyLink: () => void;
		onShare: () => void;
		onRetry: () => void;
		stepLabel: (key: string) => string;
	} = $props();
</script>

{#if error && !setup && !loading}
	<ErrorState message={error} onretry={onRetry} />
{:else if !setup}
	<div class="studio-loading">
		{#if error}
			<div class="alert alert-danger" style="margin-bottom:0.75rem;">
				<strong>Could not load launch data:</strong> {error}
				<button class="btn btn-ghost btn-sm" type="button" onclick={onRetry}>Retry</button>
			</div>
		{/if}
		<Skeleton height="14rem" />
		<Skeleton height="20rem" />
	</div>
{:else}
	{#if error}
		<div class="alert alert-danger" style="margin-bottom:1rem;">
			<strong>Could not refresh:</strong> {error}
			<button class="btn btn-ghost btn-sm" type="button" onclick={onRetry}>Retry</button>
		</div>
	{/if}

	<div class="studio-content-grid">
		<div class="panel studio-hero-card">
			<div class="studio-hero-top">
				<div class="hero-text-block">
					<div class="hero-badge-wrap">
						<StatusBadge status={setup.setup_status ?? ''} />
						{#if !policySigned}
							<span class="badge-lock">
								<Lock size={12} strokeWidth={2.4} /> Policy Unsigned
							</span>
						{/if}
					</div>
					<h2 class="hero-heading">
						{setup.is_published
							? 'Your storefront is live and public'
							: 'Take your storefront live to customers'}
					</h2>
					<p class="hero-desc">
						{setup.is_published
							? 'Customers can reach your catalog, place orders, and pay online.'
							: `${done} of ${countable.length} launch milestones verified (${progress}% completed).`}
					</p>
				</div>

				<div class="hero-actions-block">
					{#if setup.is_published}
						<button
							class="btn btn-ghost hero-offline-btn"
							type="button"
							disabled={busy}
							onclick={onUnpublish}
						>
							Take Store Offline
						</button>
					{:else}
						<button
							class="btn btn-primary hero-publish-btn"
							type="button"
							disabled={!canPublish || busy}
							onclick={onPublish}
						>
							{#if !policySigned}
								<Lock size={16} strokeWidth={2.2} />
								Sign Policy to Go Live
							{:else}
								<Rocket size={16} strokeWidth={2.2} />
								{busy ? 'Publishing…' : 'Publish Store & Go Live'}
							{/if}
						</button>
					{/if}
				</div>
			</div>

			<div class="launch-progress-box">
				<div class="progress-meta-row">
					<span class="progress-label">Launch Readiness Milestones</span>
					<span class="progress-counter-badge">
						<strong>{done}</strong> of <strong>{countable.length}</strong> ({progress}%)
					</span>
				</div>
				<div
					class="segmented-track"
					role="progressbar"
					aria-valuenow={progress}
					aria-valuemin="0"
					aria-valuemax="100"
				>
					{#each countable as step (step.key)}
						{@const isStepDone =
							step.key === 'policy'
								? policySigned
								: Boolean(setup.steps?.[step.key as SetupStepKey])}
						<div
							class="segment-bar"
							class:completed={isStepDone}
							title={`${step.label}: ${isStepDone ? 'Completed' : 'Pending'}`}
						></div>
					{/each}
				</div>
			</div>

			{#if !policySigned}
				<div class="policy-notice-box">
					<ShieldAlert size={20} strokeWidth={2} class="policy-notice-icon" />
					<div class="policy-notice-body">
						<strong>Orderly Business Operations Policy must be signed</strong>
						<p>Review and digitally sign before publishing a live storefront.</p>
					</div>
					<button
						class="btn btn-primary btn-sm policy-sign-cta"
						type="button"
						onclick={() => onSetTab('compliance')}
					>
						Review &amp; Sign Policy
					</button>
				</div>
			{:else if !canPublish && missing.length > 0}
				<div class="checklist-notice-box">
					<AlertCircle size={18} strokeWidth={2} class="checklist-notice-icon" />
					<div class="checklist-notice-body">
						<strong>Outstanding before publish:</strong>
						<span>{missing.map(stepLabel).join(', ')}.</span>
					</div>
				</div>
			{/if}
		</div>

		<div class="panel studio-checklist-panel">
			<div class="section-title-wrap">
				<div>
					<h3 class="section-h">Launch Setup Milestones</h3>
					<p class="section-note">Complete each step before going live.</p>
				</div>
				<span class="milestones-counter">{done} / {countable.length}</span>
			</div>

			<ul class="checklist-grid">
				{#each STEPS as s, i (s.key)}
					{@const isDone =
						s.key === 'policy' ? policySigned : Boolean(setup.steps?.[s.key as SetupStepKey])}
					<li class="checklist-item-card" class:is-done={isDone}>
						<div class="check-icon-wrap" class:done={isDone}>
							{#if isDone}
								<CircleCheck size={20} strokeWidth={2.2} />
							{:else}
								<CircleDashed size={20} strokeWidth={1.8} />
							{/if}
						</div>
						<div class="check-main-wrap">
							<div class="check-title-row">
								<h4 class="check-title">
									<span class="step-num">{i + 1}.</span> {s.label}
								</h4>
								{#if s.optional}
									<span class="optional-pill">Optional</span>
								{/if}
								{#if isDone}
									<span class="status-chip success"
										>{s.key === 'policy' ? 'Verified' : 'Ready'}</span
									>
								{:else if s.key === 'policy'}
									<span class="status-chip warning">Signature Required</span>
								{:else}
									<span class="status-chip pending">Incomplete</span>
								{/if}
							</div>
							<p class="check-hint">{s.hint}</p>
						</div>
						<div class="check-action-wrap">
							{#if s.isTab && s.tab}
								<button
									type="button"
									class="btn btn-ghost btn-sm check-action-btn"
									onclick={() => onSetTab(s.tab!)}
								>
									<span>{isDone ? 'View' : 'Configure'}</span>
									<ArrowRight size={14} strokeWidth={2} />
								</button>
							{:else}
								<a class="btn btn-ghost btn-sm check-action-btn" href={s.href}>
									<span>{isDone ? 'Review' : 'Configure'}</span>
									<ArrowRight size={14} strokeWidth={2} />
								</a>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		</div>

		{#if storefrontUrl}
			<div class="panel studio-share-panel">
				<div class="share-panel-header">
					<div>
						<h3 class="section-h">Storefront Link</h3>
						<p class="section-note">Share or open your public storefront.</p>
					</div>
					<a class="btn btn-ghost btn-sm" href="/shop/storefront/promote?tab=marketing&asset=qr">
						<QrCode size={15} strokeWidth={2} />
						<span>QR</span>
					</a>
				</div>
				<div class="share-link-box">
					<code class="share-url">{storefrontUrl}</code>
					<button type="button" class="btn btn-ghost btn-sm copy-btn" onclick={onCopyLink}>
						{#if copiedLink}
							<Check size={15} strokeWidth={2.4} style="color:var(--success)" />
							<span>Copied!</span>
						{:else}
							<Copy size={15} strokeWidth={2} />
							<span>Copy</span>
						{/if}
					</button>
				</div>
				<div class="share-actions-row">
					<button class="btn btn-ghost" type="button" onclick={onShare}>
						<Share2 size={15} strokeWidth={2} />
						<span>Share</span>
					</button>
					<a class="btn btn-ghost" href={storefrontUrl} target="_blank" rel="noreferrer">
						<ExternalLink size={15} strokeWidth={2} />
						<span>Open</span>
					</a>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.studio-hero-card {
		padding: 1.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md, 12px);
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.studio-hero-top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1.5rem;
		flex-wrap: wrap;
	}
	.hero-text-block {
		flex: 1;
		min-width: 240px;
	}
	.hero-badge-wrap {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	.badge-lock {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.72rem;
		font-weight: 700;
		color: #ef4444;
		background: rgba(239, 68, 68, 0.1);
		padding: 2px 7px;
		border-radius: 4px;
	}
	.hero-heading {
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 700;
		color: var(--text);
		margin: 0 0 0.35rem;
	}
	.hero-desc {
		margin: 0;
		font-size: var(--fs-body, 0.875rem);
		color: var(--text-2);
		line-height: 1.45;
	}
	.hero-actions-block {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.hero-publish-btn {
		min-height: 2.75rem;
		padding: 0 1.25rem;
		font-weight: 650;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}
	.hero-offline-btn {
		min-height: 2.75rem;
		padding: 0 1.1rem;
	}
	.launch-progress-box {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding: 0.85rem 1rem;
		background: var(--surface-2);
		border-radius: var(--radius-sm, 8px);
		border: 1px solid var(--border);
	}
	.progress-meta-row {
		display: flex;
		justify-content: space-between;
		font-size: var(--fs-meta, 0.78rem);
	}
	.progress-label {
		color: var(--text-2);
		font-weight: 600;
	}
	.progress-counter-badge {
		color: var(--text-3);
	}
	.progress-counter-badge strong {
		color: var(--text);
	}
	.segmented-track {
		display: flex;
		gap: 5px;
		height: 6px;
	}
	.segment-bar {
		flex: 1;
		background: var(--surface-3);
		border-radius: 999px;
	}
	.segment-bar.completed {
		background: var(--text);
	}
	.policy-notice-box {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.95rem 1.15rem;
		background: rgba(239, 68, 68, 0.08);
		border: 1px solid rgba(239, 68, 68, 0.25);
		border-radius: var(--radius-sm, 8px);
		flex-wrap: wrap;
	}
	:global(.policy-notice-icon) {
		color: #ef4444;
		flex-shrink: 0;
	}
	.policy-notice-body {
		flex: 1;
		min-width: 200px;
	}
	.policy-notice-body strong {
		display: block;
		font-size: 0.88rem;
		color: #ef4444;
		margin-bottom: 0.2rem;
	}
	.policy-notice-body p {
		margin: 0;
		font-size: var(--fs-meta, 0.78rem);
		color: var(--text-2);
	}
	.policy-sign-cta {
		background: #ef4444;
		border-color: #ef4444;
		color: #fff;
	}
	.checklist-notice-box {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 8px);
		font-size: var(--fs-meta, 0.8rem);
		color: var(--text-2);
	}
	:global(.checklist-notice-icon) {
		color: var(--warning, #f59e0b);
		flex-shrink: 0;
	}
	.studio-checklist-panel,
	.studio-share-panel {
		padding: 1.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md, 12px);
	}
	.milestones-counter {
		font-size: var(--fs-meta, 0.78rem);
		font-weight: 650;
		color: var(--text-2);
	}
	.checklist-grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}
	.checklist-item-card {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.85rem 1rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 8px);
		background: var(--surface-2);
	}
	.checklist-item-card.is-done {
		background: var(--surface);
	}
	.check-icon-wrap {
		color: var(--text-3);
		flex-shrink: 0;
	}
	.check-icon-wrap.done {
		color: #10b981;
	}
	.check-main-wrap {
		flex: 1;
		min-width: 0;
	}
	.check-title-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-bottom: 0.2rem;
	}
	.check-title {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 650;
		color: var(--text);
	}
	.step-num {
		color: var(--text-3);
		font-weight: 600;
	}
	.check-hint {
		margin: 0;
		font-size: var(--fs-meta, 0.78rem);
		color: var(--text-2);
	}
	.optional-pill {
		font-size: 0.65rem;
		font-weight: 700;
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		background: var(--surface-3);
		color: var(--text-3);
		text-transform: uppercase;
	}
	.status-chip {
		font-size: 0.65rem;
		font-weight: 700;
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		text-transform: uppercase;
	}
	.status-chip.success {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
	}
	.status-chip.warning {
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
	}
	.status-chip.pending {
		background: var(--surface-3);
		color: var(--text-3);
	}
	.check-action-wrap {
		flex-shrink: 0;
	}
	.check-action-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}
	.share-panel-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.share-link-box {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.65rem 0.85rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 8px);
		margin-bottom: 0.85rem;
	}
	.share-url {
		flex: 1;
		font-size: 0.8rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.share-actions-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.alert {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
		padding: 0.75rem 1rem;
		border-radius: var(--radius-sm, 8px);
	}
	.alert-danger {
		background: rgba(239, 68, 68, 0.08);
		border: 1px solid rgba(239, 68, 68, 0.25);
		color: var(--text);
	}
</style>
