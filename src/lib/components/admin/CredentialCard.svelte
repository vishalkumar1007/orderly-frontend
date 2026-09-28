<script lang="ts">
	import { toast } from './toast';
	import Building2 from '@lucide/svelte/icons/building-2';
	import Check from '@lucide/svelte/icons/check';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Copy from '@lucide/svelte/icons/copy';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Globe from '@lucide/svelte/icons/globe';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Link from '@lucide/svelte/icons/link';
	import Lock from '@lucide/svelte/icons/lock';
	import Mail from '@lucide/svelte/icons/mail';
	import Store from '@lucide/svelte/icons/store';
	import UserRound from '@lucide/svelte/icons/user-round';

	let {
		tenantName = '',
		slug = '',
		adminEmail = '',
		setupUrl = '',
		loginUrl = '',
		storefrontUrl = '',
		plan = '',
		emailSent = false,
		emailError = '',
		setupStatus = 'PENDING'
	}: {
		tenantName?: string;
		slug?: string;
		adminEmail?: string;
		setupUrl?: string;
		loginUrl?: string;
		storefrontUrl?: string;
		plan?: string;
		emailSent?: boolean;
		emailError?: string;
		setupStatus?: string;
	} = $props();

	const shopUrl = $derived(storefrontUrl ? `${storefrontUrl.replace(/\/$/, '')}/shop` : '');

	let copiedItem = $state('');
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	async function copy(text: string, label: string) {
		try {
			await navigator.clipboard.writeText(text);
			copiedItem = label;
			toast.success(`${label} copied`);
			clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (copiedItem = ''), 2000);
		} catch {
			toast.error('Could not copy to clipboard');
		}
	}

	function isCopied(label: string) {
		return copiedItem === label;
	}
</script>

<div class="credential-card card-panel">
	<div class="credential-card-header">
		<div class="credential-card-header-icon">
			<CircleCheck size={22} strokeWidth={2} />
		</div>
		<div class="credential-card-header-text">
			<h3>Set up customer tenant</h3>
			<p class="muted">
				Tenant provisioned with setup status
				<span class="badge badge-warn">{setupStatus}</span>.
				Complete these steps with the tenant admin.
			</p>
		</div>
	</div>

	<div class="setup-steps">
		<h4 class="setup-steps-title">Next steps</h4>
		<ol class="setup-checklist">
			<li>
				<span class="setup-checklist-icon"><Mail size={13} strokeWidth={2} /></span>
				<span>
					{#if emailSent}
						A setup email was sent to <strong>{adminEmail}</strong>.
					{:else if emailError}
						Email was not sent ({emailError}). Copy the setup link for <strong>{adminEmail}</strong>.
					{:else}
						SMTP is not configured. Copy the setup link and send it to <strong>{adminEmail}</strong>.
					{/if}
				</span>
			</li>
			<li>
				<span class="setup-checklist-icon"><KeyRound size={13} strokeWidth={2} /></span>
				<span>They open the link on <code>{slug}.localhost</code> and choose a password.</span>
			</li>
			<li>
				<span class="setup-checklist-icon"><Store size={13} strokeWidth={2} /></span>
				<span>They sign in at the tenant login URL and open the shop dashboard to finish menu setup.</span>
			</li>
		</ol>
	</div>

	<div class="credential-actions">
		<button type="button" class="btn btn-primary credential-copy-btn" onclick={() => copy(setupUrl, 'setup-link')}>
			{#if isCopied('setup-link')}
				<Check size={15} strokeWidth={2.5} />
				Copied!
			{:else}
				<Copy size={15} strokeWidth={2} />
				Copy setup link
			{/if}
		</button>
		{#if storefrontUrl}
			<a class="btn btn-ghost" href={storefrontUrl} target="_blank" rel="noopener">
				<ExternalLink size={14} strokeWidth={2} />
				Open storefront
			</a>
		{/if}
		<a class="btn btn-ghost" href={loginUrl} target="_blank" rel="noopener">
			<ExternalLink size={14} strokeWidth={2} />
			Open tenant login
		</a>
		{#if shopUrl}
			<a class="btn btn-ghost" href={shopUrl} target="_blank" rel="noopener">
				<ExternalLink size={14} strokeWidth={2} />
				Open shop
			</a>
		{/if}
	</div>

	<dl class="credential-list">
		<div class="credential-row">
			<dt><Building2 size={14} strokeWidth={2} />Business</dt>
			<dd>{tenantName}</dd>
		</div>
		<div class="credential-row">
			<dt><Globe size={14} strokeWidth={2} />Slug / host</dt>
			<dd><code>{slug}</code></dd>
		</div>
		{#if plan}
			<div class="credential-row">
				<dt><Store size={14} strokeWidth={2} />Plan</dt>
				<dd>{plan}</dd>
			</div>
		{/if}
		<div class="credential-row">
			<dt><UserRound size={14} strokeWidth={2} />Admin email</dt>
			<dd class="credential-value-with-action">
				<span>{adminEmail}</span>
				<button type="button" class="btn btn-ghost btn-sm credential-inline-copy" onclick={() => copy(adminEmail, 'admin-email')} aria-label="Copy admin email">
					{#if isCopied('admin-email')}<Check size={12} strokeWidth={2.5} />{:else}<Copy size={12} strokeWidth={2} />{/if}
				</button>
			</dd>
		</div>
		<div class="credential-row">
			<dt><Link size={14} strokeWidth={2} />Password setup</dt>
			<dd class="credential-value-with-action">
				<code class="credential-code">{setupUrl}</code>
				<button type="button" class="btn btn-ghost btn-sm credential-inline-copy" onclick={() => copy(setupUrl, 'setup-url')} aria-label="Copy setup URL">
					{#if isCopied('setup-url')}<Check size={12} strokeWidth={2.5} />{:else}<Copy size={12} strokeWidth={2} />{/if}
				</button>
			</dd>
		</div>
		<div class="credential-row">
			<dt><Lock size={14} strokeWidth={2} />Store login</dt>
			<dd class="credential-value-with-action">
				<a href={loginUrl} target="_blank" rel="noopener noreferrer" class="credential-link">{loginUrl}</a>
				<button type="button" class="btn btn-ghost btn-sm credential-inline-copy" onclick={() => copy(loginUrl, 'login-url')} aria-label="Copy login URL">
					{#if isCopied('login-url')}<Check size={12} strokeWidth={2.5} />{:else}<Copy size={12} strokeWidth={2} />{/if}
				</button>
			</dd>
		</div>
	</dl>
</div>

<style>
	.credential-card {
		padding: 1.25rem;
	}

	.credential-card-header {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		margin-bottom: 1.25rem;
	}

	.credential-card-header-icon {
		flex-shrink: 0;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: var(--radius-sm);
		background: var(--success-bg);
		color: var(--success);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.credential-card-header-text h3 {
		margin: 0 0 0.25rem;
		font-size: 1rem;
		font-weight: 650;
		letter-spacing: -0.01em;
	}

	.credential-card-header-text p {
		margin: 0;
		font-size: 0.83rem;
		line-height: 1.5;
		color: var(--text-2);
	}

	.setup-steps {
		margin-bottom: 1.25rem;
		padding: 0.85rem 1rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
	}

	.setup-steps-title {
		margin: 0 0 0.6rem;
		font-size: 0.68rem;
		font-weight: 650;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-3);
	}

	.setup-checklist li {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		font-size: 0.82rem;
	}

	.setup-checklist-icon {
		flex-shrink: 0;
		width: 1.2rem;
		height: 1.2rem;
		border-radius: 999px;
		background: var(--icon-bg);
		color: var(--icon-fg);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 0.1rem;
	}

	.credential-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 1.25rem;
	}

	.credential-copy-btn {
		min-width: 9rem;
	}

	.credential-list {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.credential-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.55rem 0.7rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
	}

	.credential-row dt {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-3);
	}

	.credential-row dd {
		margin: 0;
		font-size: 0.82rem;
		min-width: 0;
		text-align: right;
		word-break: break-all;
	}

	.credential-value-with-action {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.4rem;
	}

	.credential-code {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--text-2);
		word-break: break-all;
	}

	.credential-link {
		color: var(--accent-dark);
		text-decoration: none;
		font-size: 0.78rem;
		word-break: break-all;
	}

	.credential-link:hover {
		text-decoration: underline;
	}

	.credential-inline-copy {
		flex-shrink: 0;
		padding: 0.25rem 0.4rem;
	}
</style>
