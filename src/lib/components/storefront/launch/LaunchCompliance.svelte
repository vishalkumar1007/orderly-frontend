<script lang="ts">
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import ShieldAlert from '@lucide/svelte/icons/shield-alert';
	import BusinessPolicyModal from '$lib/components/tenant/BusinessPolicyModal.svelte';
	import { policyStore, type PolicySignature } from '$lib/tenant/policyStore';
	import { toast } from '$lib/components/admin/toast';
	import type { StoreLink, TabKey } from './types';
	import './launch-shared.css';

	let {
		tenantSlug,
		store,
		policySigned = $bindable(false),
		policySignature = $bindable<PolicySignature | null>(null),
		onSetTab
	}: {
		tenantSlug: string;
		store: StoreLink | null;
		policySigned?: boolean;
		policySignature?: PolicySignature | null;
		onSetTab: (tab: TabKey) => void;
	} = $props();

	let showPolicyModal = $state(false);
	let signerName = $state('');
	let agreedToTerms = $state(false);
	let signingPolicy = $state(false);

	async function handleSignPolicy() {
		if (!signerName.trim()) {
			toast.error('Enter your legal name as authorized signer.');
			return;
		}
		if (!agreedToTerms) {
			toast.error('Accept the agreement checkbox to sign.');
			return;
		}
		signingPolicy = true;
		try {
			policyStore.sign(tenantSlug, signerName.trim(), 'owner@orderly.store');
			policySignature = policyStore.getSignature(tenantSlug);
			policySigned = true;
			toast.success('Policy signed. Launch unlocked.');
		} finally {
			signingPolicy = false;
		}
	}
</script>

<div class="studio-content-grid">
	<div class="panel studio-section-intro">
		<div class="intro-icon-wrap policy">
			<ShieldCheck size={24} strokeWidth={1.8} />
		</div>
		<div>
			<h2 class="intro-h">Merchant Policy</h2>
			<p class="intro-p">
				Sign the Orderly Operations Policy before your storefront can go live.
			</p>
		</div>
	</div>

	{#if policySigned}
		<div class="panel policy-verified-card">
			<div class="verified-header">
				<div class="verified-icon-circle">
					<ShieldCheck size={28} strokeWidth={2} />
				</div>
				<div>
					<span class="verified-badge">Digitally Verified</span>
					<h3 class="verified-title">Merchant Agreement Active</h3>
					<p class="verified-desc">
						Signed by {policySignature?.signerName || 'Owner'}
						{#if policySignature?.signedAt}
							on {new Date(policySignature.signedAt).toLocaleDateString()}
						{/if}
					</p>
				</div>
			</div>
			<div class="verified-card-actions">
				<button type="button" class="btn btn-ghost" onclick={() => (showPolicyModal = true)}>
					Read Agreement
				</button>
				<button type="button" class="btn btn-primary" onclick={() => onSetTab('readiness')}>
					Return to Launch Readiness
				</button>
			</div>
		</div>
	{:else}
		<div class="panel policy-signing-panel">
			<div class="signing-alert-banner">
				<ShieldAlert size={20} strokeWidth={2} />
				<div>
					<strong>Signature required</strong>
					<p>Publishing is blocked until an authorized representative signs.</p>
				</div>
			</div>

			<div class="policy-document-container">
				<article class="policy-article">
					<h4>Operational standards</h4>
					<p>
						Keep hours and availability accurate. Communicate delays promptly. Pricing and fees
						shown on the storefront must match what customers pay.
					</p>
				</article>
				<article class="policy-article">
					<h4>Customer privacy</h4>
					<p>
						Customer contact details from Orderly are confidential and must not be sold or used for
						unsolicited marketing without consent.
					</p>
				</article>
				<article class="policy-article">
					<h4>Fair use</h4>
					<p>
						No scraping, fraudulent orders, or sharing credentials with unauthorized parties.
						Violations may suspend the tenant account.
					</p>
				</article>
			</div>

			<div class="policy-sign-form">
				<div class="form-field">
					<label class="form-label" for="signer-name">Signer full legal name *</label>
					<input
						id="signer-name"
						type="text"
						class="text-input"
						placeholder="e.g. Your Name"
						bind:value={signerName}
					/>
				</div>

				<label class="agreement-checkbox-row">
					<input type="checkbox" class="custom-checkbox" bind:checked={agreedToTerms} />
					<span class="checkbox-text">
						I am authorized to bind <strong>{store?.name || tenantSlug}</strong> to the Orderly
						Merchant Agreement.
					</span>
				</label>

				<div class="sign-actions-row">
					<button
						type="button"
						class="btn btn-primary"
						disabled={signingPolicy || !agreedToTerms || !signerName.trim()}
						onclick={handleSignPolicy}
					>
						<ShieldCheck size={16} strokeWidth={2.2} />
						{signingPolicy ? 'Signing…' : 'Sign & Unlock Launch'}
					</button>
					<button type="button" class="btn btn-ghost" onclick={() => (showPolicyModal = true)}>
						Open Full Document
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<BusinessPolicyModal
	bind:open={showPolicyModal}
	{tenantSlug}
	businessName={store?.name || tenantSlug}
	mandatory={false}
	onsigned={() => {
		policySignature = policyStore.getSignature(tenantSlug);
		policySigned = true;
	}}
/>

<style>
	.policy-verified-card,
	.policy-signing-panel {
		padding: 1.25rem 1.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md, 12px);
	}
	.verified-header {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
		margin-bottom: 1.25rem;
	}
	.verified-icon-circle {
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
		flex-shrink: 0;
	}
	.verified-badge {
		display: inline-block;
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		color: #10b981;
		margin-bottom: 0.35rem;
	}
	.verified-title {
		margin: 0 0 0.25rem;
		font-size: 1.05rem;
	}
	.verified-desc {
		margin: 0;
		font-size: var(--fs-meta, 0.8rem);
		color: var(--text-2);
	}
	.verified-card-actions,
	.sign-actions-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
	}
	.signing-alert-banner {
		display: flex;
		gap: 0.85rem;
		padding: 0.85rem 1rem;
		background: rgba(239, 68, 68, 0.08);
		border: 1px solid rgba(239, 68, 68, 0.25);
		border-radius: var(--radius-sm, 8px);
		margin-bottom: 1.15rem;
		color: var(--text);
	}
	.signing-alert-banner strong {
		display: block;
		color: #ef4444;
		margin-bottom: 0.2rem;
	}
	.signing-alert-banner p {
		margin: 0;
		font-size: var(--fs-meta, 0.8rem);
		color: var(--text-2);
	}
	.policy-document-container {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		max-height: 16rem;
		overflow: auto;
		padding: 1rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 8px);
		margin-bottom: 1.15rem;
	}
	.policy-article h4 {
		margin: 0 0 0.35rem;
		font-size: 0.88rem;
	}
	.policy-article p {
		margin: 0;
		font-size: var(--fs-meta, 0.8rem);
		color: var(--text-2);
		line-height: 1.45;
	}
	.policy-sign-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.form-field {
		max-width: 24rem;
	}
	.agreement-checkbox-row {
		display: flex;
		gap: 0.65rem;
		align-items: flex-start;
		font-size: var(--fs-meta, 0.82rem);
		color: var(--text-2);
		cursor: pointer;
	}
	.custom-checkbox {
		margin-top: 0.2rem;
	}
</style>
