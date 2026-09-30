<script lang="ts">
	import { onMount } from 'svelte';
	import {
		IconShieldCheck,
		IconCircleCheck,
		IconLock,
		IconX,
		IconAlertCircle
	} from '@tabler/icons-svelte';
	import { policyStore, type PolicySignature } from '$lib/tenant/policyStore';
	import { toast } from '$lib/components/admin/toast';

	let {
		open = $bindable(false),
		tenantSlug = '',
		businessName = '',
		userName = '',
		userEmail = '',
		mandatory = false,
		onsigned
	}: {
		open: boolean;
		tenantSlug: string;
		businessName?: string;
		userName?: string;
		userEmail?: string;
		mandatory?: boolean;
		onsigned?: (sig: PolicySignature) => void;
	} = $props();

	let signerName = $state(userName || '');
	let accepted = $state(false);
	let error = $state('');
	let isSubmitting = $state(false);

	let currentSignature = $state<PolicySignature | null>(null);

	$effect(() => {
		if (open && tenantSlug) {
			currentSignature = policyStore.getSignature(tenantSlug);
			if (!signerName && userName) {
				signerName = userName;
			}
		}
	});

	function handleSign() {
		error = '';
		if (!signerName.trim()) {
			error = 'Please enter your full legal name to sign the policy.';
			return;
		}
		if (!accepted) {
			error = 'You must confirm and accept the Orderly Business Policy.';
			return;
		}

		isSubmitting = true;
		try {
			const sig = policyStore.sign(tenantSlug, signerName, userEmail || 'admin');
			currentSignature = sig;
			toast.success('Business Policy successfully signed! Setup unlocked.');
			onsigned?.(sig);
			if (!mandatory) {
				open = false;
			} else {
				// brief delay so user sees confirmation before modal closes
				setTimeout(() => {
					open = false;
				}, 600);
			}
		} catch (e) {
			error = 'Failed to record signature. Please try again.';
		} finally {
			isSubmitting = false;
		}
	}

	function handleSkip() {
		policyStore.skip(tenantSlug);
		toast.info('Policy skipped for now. Review and sign in Storefront Launch before publishing live.');
		open = false;
	}

	function handleClose() {
		if (!currentSignature?.signed) {
			handleSkip();
		} else {
			open = false;
		}
	}

	function formatDate(iso: string): string {
		try {
			return new Date(iso).toLocaleDateString(undefined, {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return iso;
		}
	}
</script>

{#if open}
	<div
		class="policy-backdrop"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) handleClose();
		}}
	>
		<div
			class="policy-modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby="policy-title"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Modal Header -->
			<div class="policy-head">
				<div class="policy-head-badge-row">
					<span class="policy-tag primary">
						<IconShieldCheck size={14} stroke={2.2} />
						<span>Orderly Legal &amp; Governance</span>
					</span>
					<span class="policy-tag muted">Version 1.0.0</span>
					{#if currentSignature?.signed}
						<span class="policy-tag success">
							<IconCircleCheck size={14} stroke={2.2} />
							<span>Signed &amp; Active</span>
						</span>
					{:else}
						<span class="policy-tag warning">
							<IconLock size={13} stroke={2.2} />
							<span>Step 1 of Setup</span>
						</span>
					{/if}
				</div>

				<div class="policy-title-row">
					<div>
						<h2 id="policy-title" class="policy-title">
							Orderly Business Operations Policy
						</h2>
						<p class="policy-subtitle">
							Merchant Agreement &amp; Operating Standards for {businessName || tenantSlug || 'Your Organization'}
						</p>
					</div>

					<button
						type="button"
						class="policy-close-btn"
						onclick={handleClose}
						title="Close dialog"
						aria-label="Close dialog"
					>
						<IconX size={18} stroke={2} />
					</button>
				</div>
			</div>

			<!-- Scrollable Agreement Body -->
			<div class="policy-body">
				{#if currentSignature?.signed}
					<div class="policy-signed-banner">
						<IconCircleCheck size={24} stroke={2.2} class="signed-icon" />
						<div class="signed-info">
							<strong>Policy Digitally Executed</strong>
							<p>
								Signed by <span class="signed-name">{currentSignature.signerName}</span>
								({currentSignature.signerEmail}) on {formatDate(currentSignature.signedAt)}.
								This agreement is actively attached to {tenantSlug}.
							</p>
						</div>
					</div>
				{/if}

				<div class="policy-intro">
					<p>
						Welcome to Orderly. Prior to operating your storefront, accepting customer orders, and configuring automated payment or kitchen workflows, every business administrator is required to review and digitally sign this Business Operations Policy.
					</p>
				</div>

				<div class="policy-articles">
					<div class="policy-article">
						<span class="article-num">Article 1</span>
						<h3 class="article-title">Authorized Merchant Operations &amp; Identity</h3>
						<p class="article-text">
							Orderly grants the Merchant a revocable, non-exclusive platform license to host digital storefronts, manage live kitchen dispatch, and process customer orders. The Merchant certifies that all business registrations, operating permits, and local food or retail licenses comply fully with applicable laws.
						</p>
					</div>

					<div class="policy-article">
						<span class="article-num">Article 2</span>
						<h3 class="article-title">Transaction Processing &amp; Payment Settlement</h3>
						<p class="article-text">
							Merchants must ensure accurate product pricing, appropriate tax calculations, and fulfillment of orders paid online or in-store. Orderly does not withhold or custody merchant revenue; settlements flow directly through the merchant's configured gateway provider. In the event of chargebacks or disputes, the Merchant assumes full responsibility for customer resolution.
						</p>
					</div>

					<div class="policy-article">
						<span class="article-num">Article 3</span>
						<h3 class="article-title">Customer Data Protection &amp; Privacy Compliance</h3>
						<p class="article-text">
							Customer credentials, phone numbers, delivery addresses, and transactional histories captured through Orderly storefronts are strictly proprietary to your business. The Merchant agrees to handle this information in accordance with GDPR, DPDP, and consumer protection regulations, and will never distribute or resell customer information.
						</p>
					</div>

					<div class="policy-article">
						<span class="article-num">Article 4</span>
						<h3 class="article-title">Platform Uptime, Security &amp; Fair Use</h3>
						<p class="article-text">
							Orderly targets continuous 99.9% core service availability. Merchants agree to refrain from unauthorized automated API scraping, denial-of-service simulations, or fraudulent order injections. All operations are monitored through isolated audit logs.
						</p>
					</div>

					<div class="policy-article">
						<span class="article-num">Article 5</span>
						<h3 class="article-title">Prohibited Conduct &amp; Termination</h3>
						<p class="article-text">
							Conducting fraudulent activities, hosting unauthorized or illegal items, or violating customer security will lead to instantaneous tenant suspension. Orderly reserves the right to suspend platform access upon verified compliance violations.
						</p>
					</div>
				</div>
			</div>

			<!-- Digital Signature / Footer -->
			<div class="policy-foot">
				{#if !currentSignature?.signed}
					<div class="policy-sign-form">
						{#if error}
							<div class="policy-error-alert" role="alert">
								<IconAlertCircle size={16} stroke={2.2} />
								<span>{error}</span>
							</div>
						{/if}

						<div class="sign-fields">
							<div class="sign-field">
								<label for="signer-name" class="sign-label">Signer Full Legal Name <span class="req">*</span></label>
								<input
									id="signer-name"
									type="text"
									class="sign-input"
									placeholder="e.g. Alex Henderson"
									bind:value={signerName}
								/>
							</div>
							<div class="sign-field">
								<span class="sign-label">Signer Account</span>
								<div class="sign-account-pill">
									<span>{userEmail || 'admin@' + tenantSlug}</span>
									<span class="sign-role-badge">Owner</span>
								</div>
							</div>
						</div>

						<label class="policy-checkbox-label">
							<input
								type="checkbox"
								class="policy-checkbox"
								bind:checked={accepted}
							/>
							<span class="checkbox-text">
								I, as the authorized administrator and representative of <strong>{businessName || tenantSlug}</strong>, confirm that I have reviewed, understood, and accept the <strong>Orderly Business Operations Policy &amp; Merchant Agreement</strong>.
							</span>
						</label>

						<div class="policy-actions">
							<div class="audit-note">
								<span>Digital acceptance is recorded with IP audit timestamp</span>
							</div>
							<div class="policy-actions-btns">
								<button
									type="button"
									class="policy-skip-btn"
									onclick={handleSkip}
								>
									Skip for now
								</button>
								<button
									type="button"
									class="policy-sign-btn"
									disabled={isSubmitting}
									onclick={handleSign}
								>
									<IconShieldCheck size={16} stroke={2.2} />
									<span>{isSubmitting ? 'Signing…' : 'Sign Policy & Unlock Setup'}</span>
								</button>
							</div>
						</div>
					</div>
				{:else}
					<div class="policy-view-actions">
						<span class="policy-verified-note">
							<IconCircleCheck size={16} stroke={2} />
							<span>Agreement verified for {tenantSlug}. Your setup is fully unlocked.</span>
						</span>
						<button type="button" class="policy-done-btn" onclick={handleClose}>
							Close Policy
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.policy-backdrop {
		position: fixed;
		inset: 0;
		z-index: 9999;
		background: rgba(4, 7, 14, 0.78);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		display: grid;
		place-items: center;
		padding: 1rem;
		box-sizing: border-box;
		animation: policyFadeIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	}

	@keyframes policyFadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.policy-modal {
		background: var(--surface, #ffffff);
		border: 1px solid var(--border, #e2e8f0);
		border-radius: 20px;
		width: 100%;
		max-width: 680px;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 24px 64px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.04);
		overflow: hidden;
		animation: policySlideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);
		color: var(--text, #0f172a);
	}

	:global([data-theme='dark']) .policy-modal,
	:global(html[data-theme='dark']) .policy-modal {
		background: #0f1422;
		border-color: rgba(255, 255, 255, 0.12);
		color: #f8fafc;
		box-shadow: 0 24px 64px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.05);
	}

	@keyframes policySlideUp {
		from {
			opacity: 0;
			transform: translateY(16px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.policy-head {
		padding: 1.5rem 1.75rem 1.25rem;
		border-bottom: 1px solid var(--border, #e2e8f0);
		background: var(--surface-2, #f8fafc);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		flex: none;
	}

	:global([data-theme='dark']) .policy-head,
	:global(html[data-theme='dark']) .policy-head {
		background: rgba(255, 255, 255, 0.02);
		border-color: rgba(255, 255, 255, 0.08);
	}

	.policy-head-badge-row {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}

	.policy-tag {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 3px 9px;
		border-radius: 9999px;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.02em;
	}

	.policy-tag.primary {
		background: color-mix(in srgb, var(--accent, #6366f1) 14%, transparent);
		color: var(--accent, #4f46e5);
		border: 1px solid color-mix(in srgb, var(--accent, #6366f1) 28%, transparent);
	}

	:global([data-theme='dark']) .policy-tag.primary,
	:global(html[data-theme='dark']) .policy-tag.primary {
		color: #a5b4fc;
	}

	.policy-tag.muted {
		background: var(--surface-3, #f1f5f9);
		color: var(--text-2, #64748b);
		border: 1px solid var(--border, #e2e8f0);
	}

	:global([data-theme='dark']) .policy-tag.muted,
	:global(html[data-theme='dark']) .policy-tag.muted {
		background: rgba(255, 255, 255, 0.06);
		color: #94a3b8;
		border-color: rgba(255, 255, 255, 0.08);
	}

	.policy-tag.success {
		background: rgba(34, 197, 94, 0.12);
		color: #16a34a;
		border: 1px solid rgba(34, 197, 94, 0.25);
	}

	:global([data-theme='dark']) .policy-tag.success,
	:global(html[data-theme='dark']) .policy-tag.success {
		color: #4ade80;
	}

	.policy-tag.warning {
		background: rgba(234, 179, 8, 0.12);
		color: #ca8a04;
		border: 1px solid rgba(234, 179, 8, 0.25);
	}

	:global([data-theme='dark']) .policy-tag.warning,
	:global(html[data-theme='dark']) .policy-tag.warning {
		color: #facc15;
	}

	.policy-title-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.policy-title {
		font-family: var(--font-display, inherit);
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text, #0f172a);
		margin: 0 0 0.25rem;
		letter-spacing: -0.015em;
	}

	:global([data-theme='dark']) .policy-title,
	:global(html[data-theme='dark']) .policy-title {
		color: #f8fafc;
	}

	.policy-subtitle {
		font-size: 0.825rem;
		color: var(--text-2, #64748b);
		margin: 0;
	}

	:global([data-theme='dark']) .policy-subtitle,
	:global(html[data-theme='dark']) .policy-subtitle {
		color: #94a3b8;
	}

	.policy-close-btn {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		border: 1px solid var(--border, #cbd5e1);
		background: var(--surface, #ffffff);
		color: var(--text-2, #64748b);
		display: grid;
		place-items: center;
		cursor: pointer;
		transition: all 0.15s ease;
		flex: none;
	}

	.policy-close-btn:hover {
		background: var(--surface-2, #f1f5f9);
		color: var(--text, #0f172a);
		border-color: var(--border-hover, #94a3b8);
	}

	:global([data-theme='dark']) .policy-close-btn,
	:global(html[data-theme='dark']) .policy-close-btn {
		background: rgba(255, 255, 255, 0.04);
		border-color: rgba(255, 255, 255, 0.08);
		color: #cbd5e1;
	}

	:global([data-theme='dark']) .policy-close-btn:hover,
	:global(html[data-theme='dark']) .policy-close-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #ffffff;
	}

	.policy-body {
		padding: 1.5rem 1.75rem;
		overflow-y: auto;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		scrollbar-width: thin;
	}

	.policy-signed-banner {
		display: flex;
		align-items: flex-start;
		gap: 0.85rem;
		padding: 1rem 1.15rem;
		border-radius: 12px;
		background: rgba(34, 197, 94, 0.1);
		border: 1px solid rgba(34, 197, 94, 0.25);
		color: var(--text, #0f172a);
	}

	:global([data-theme='dark']) .policy-signed-banner,
	:global(html[data-theme='dark']) .policy-signed-banner {
		color: #f8fafc;
	}

	.policy-signed-banner :global(.signed-icon) {
		color: #16a34a;
		flex: none;
		margin-top: 1px;
	}

	:global([data-theme='dark']) .policy-signed-banner :global(.signed-icon),
	:global(html[data-theme='dark']) .policy-signed-banner :global(.signed-icon) {
		color: #4ade80;
	}

	.signed-info strong {
		display: block;
		font-size: 0.85rem;
		color: #16a34a;
		margin-bottom: 2px;
	}

	:global([data-theme='dark']) .signed-info strong,
	:global(html[data-theme='dark']) .signed-info strong {
		color: #4ade80;
	}

	.signed-info p {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-2, #475569);
		line-height: 1.45;
	}

	:global([data-theme='dark']) .signed-info p,
	:global(html[data-theme='dark']) .signed-info p {
		color: #cbd5e1;
	}

	.signed-name {
		font-weight: 700;
		color: var(--text, #0f172a);
	}

	:global([data-theme='dark']) .signed-name,
	:global(html[data-theme='dark']) .signed-name {
		color: #ffffff;
	}

	.policy-intro p {
		margin: 0;
		font-size: 0.85rem;
		color: var(--text-2, #475569);
		line-height: 1.55;
	}

	:global([data-theme='dark']) .policy-intro p,
	:global(html[data-theme='dark']) .policy-intro p {
		color: #cbd5e1;
	}

	.policy-articles {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.policy-article {
		padding: 1rem 1.15rem;
		border-radius: 12px;
		background: var(--surface-2, #f8fafc);
		border: 1px solid var(--border, #e2e8f0);
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	:global([data-theme='dark']) .policy-article,
	:global(html[data-theme='dark']) .policy-article {
		background: rgba(255, 255, 255, 0.025);
		border-color: rgba(255, 255, 255, 0.06);
	}

	.article-num {
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--accent, #4f46e5);
	}

	:global([data-theme='dark']) .article-num,
	:global(html[data-theme='dark']) .article-num {
		color: #818cf8;
	}

	.article-title {
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--text, #0f172a);
		margin: 0;
	}

	:global([data-theme='dark']) .article-title,
	:global(html[data-theme='dark']) .article-title {
		color: #f8fafc;
	}

	.article-text {
		font-size: 0.8rem;
		color: var(--text-2, #64748b);
		line-height: 1.5;
		margin: 0;
	}

	:global([data-theme='dark']) .article-text,
	:global(html[data-theme='dark']) .article-text {
		color: #94a3b8;
	}

	.policy-foot {
		padding: 1.25rem 1.75rem 1.5rem;
		border-top: 1px solid var(--border, #e2e8f0);
		background: var(--surface-2, #f8fafc);
		flex: none;
	}

	:global([data-theme='dark']) .policy-foot,
	:global(html[data-theme='dark']) .policy-foot {
		background: rgba(255, 255, 255, 0.02);
		border-color: rgba(255, 255, 255, 0.08);
	}

	.policy-sign-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.policy-error-alert {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border-radius: 8px;
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.25);
		color: #dc2626;
		font-size: 0.775rem;
		font-weight: 500;
	}

	:global([data-theme='dark']) .policy-error-alert,
	:global(html[data-theme='dark']) .policy-error-alert {
		background: rgba(239, 68, 68, 0.15);
		border-color: rgba(239, 68, 68, 0.3);
		color: #fca5a5;
	}

	.sign-fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	@media (max-width: 580px) {
		.sign-fields {
			grid-template-columns: 1fr;
		}
	}

	.sign-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.sign-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text, #0f172a);
	}

	:global([data-theme='dark']) .sign-label,
	:global(html[data-theme='dark']) .sign-label {
		color: #cbd5e1;
	}

	.sign-label .req {
		color: #ef4444;
	}

	.sign-input {
		height: 38px;
		padding: 0 12px;
		border-radius: 8px;
		background: var(--surface, #ffffff);
		border: 1px solid var(--border, #cbd5e1);
		color: var(--text, #0f172a);
		font-size: 0.825rem;
		outline: none;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	.sign-input:focus {
		border-color: var(--accent, #6366f1);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent, #6366f1) 25%, transparent);
	}

	:global([data-theme='dark']) .sign-input,
	:global(html[data-theme='dark']) .sign-input {
		background: rgba(0, 0, 0, 0.35);
		border-color: rgba(255, 255, 255, 0.12);
		color: #ffffff;
	}

	.sign-account-pill {
		height: 38px;
		padding: 0 12px;
		border-radius: 8px;
		background: var(--surface, #ffffff);
		border: 1px solid var(--border, #cbd5e1);
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.8rem;
		color: var(--text-2, #64748b);
		font-family: var(--font-mono, monospace);
	}

	:global([data-theme='dark']) .sign-account-pill,
	:global(html[data-theme='dark']) .sign-account-pill {
		background: rgba(255, 255, 255, 0.04);
		border-color: rgba(255, 255, 255, 0.08);
		color: #94a3b8;
	}

	.sign-role-badge {
		font-size: 0.65rem;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 4px;
		background: color-mix(in srgb, var(--accent, #6366f1) 15%, transparent);
		color: var(--accent, #4f46e5);
	}

	:global([data-theme='dark']) .sign-role-badge,
	:global(html[data-theme='dark']) .sign-role-badge {
		color: #818cf8;
	}

	.policy-checkbox-label {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		cursor: pointer;
		font-size: 0.8rem;
		line-height: 1.45;
		color: var(--text, #0f172a);
		user-select: none;
	}

	:global([data-theme='dark']) .policy-checkbox-label,
	:global(html[data-theme='dark']) .policy-checkbox-label {
		color: #cbd5e1;
	}

	.policy-checkbox {
		margin-top: 2px;
		width: 17px;
		height: 17px;
		accent-color: var(--accent, #6366f1);
		cursor: pointer;
		flex: none;
	}

	.policy-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		padding-top: 0.5rem;
	}

	.audit-note {
		font-size: 0.725rem;
		color: var(--text-3, #94a3b8);
	}

	.policy-actions-btns {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.policy-skip-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 9px 16px;
		border-radius: 10px;
		border: 1px solid var(--border, #cbd5e1);
		background: transparent;
		color: var(--text-2, #64748b);
		font-size: 0.825rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.policy-skip-btn:hover {
		background: var(--surface-3, #e2e8f0);
		color: var(--text, #0f172a);
		border-color: var(--border-hover, #94a3b8);
	}

	:global([data-theme='dark']) .policy-skip-btn,
	:global(html[data-theme='dark']) .policy-skip-btn {
		border-color: rgba(255, 255, 255, 0.14);
		color: #cbd5e1;
	}

	:global([data-theme='dark']) .policy-skip-btn:hover,
	:global(html[data-theme='dark']) .policy-skip-btn:hover {
		background: rgba(255, 255, 255, 0.08);
		color: #ffffff;
	}

	.policy-sign-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 9px 18px;
		border-radius: 10px;
		border: none;
		background: var(--accent, #6366f1);
		color: #ffffff;
		font-size: 0.825rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.15s ease;
		box-shadow: 0 4px 14px color-mix(in srgb, var(--accent, #6366f1) 35%, transparent);
	}

	.policy-sign-btn:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 6px 20px color-mix(in srgb, var(--accent, #6366f1) 45%, transparent);
	}

	.policy-sign-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.policy-view-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.policy-verified-note {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.8rem;
		color: #16a34a;
	}

	:global([data-theme='dark']) .policy-verified-note,
	:global(html[data-theme='dark']) .policy-verified-note {
		color: #4ade80;
	}

	.policy-done-btn {
		padding: 8px 16px;
		border-radius: 8px;
		border: 1px solid var(--border, #cbd5e1);
		background: var(--surface, #ffffff);
		color: var(--text, #0f172a);
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.policy-done-btn:hover {
		background: var(--surface-2, #f1f5f9);
	}

	:global([data-theme='dark']) .policy-done-btn,
	:global(html[data-theme='dark']) .policy-done-btn {
		background: rgba(255, 255, 255, 0.05);
		border-color: rgba(255, 255, 255, 0.12);
		color: #ffffff;
	}

	:global([data-theme='dark']) .policy-done-btn:hover,
	:global(html[data-theme='dark']) .policy-done-btn:hover {
		background: rgba(255, 255, 255, 0.1);
	}
</style>
