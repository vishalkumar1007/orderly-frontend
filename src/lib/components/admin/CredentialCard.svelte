<script lang="ts">
	import { toast } from './toast';

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

	async function copy(text: string, label: string) {
		try {
			await navigator.clipboard.writeText(text);
			toast.success(`${label} copied`);
		} catch {
			toast.error('Could not copy to clipboard');
		}
	}
</script>

<div class="credential-card card-panel">
	<div class="credential-card-header">
		<h3 class="text-lg font-bold">Set up customer tenant</h3>
		<p class="muted text-sm mt-1">
			Tenant provisioned with setup status <span class="badge badge-warn">{setupStatus}</span>.
			Complete these steps with the tenant admin.
		</p>
	</div>

	<ol class="setup-checklist">
		<li>
			{#if emailSent}
				A setup email was sent to {adminEmail}.
			{:else if emailError}
				Email was not sent ({emailError}). Copy the setup link for {adminEmail}.
			{:else}
				SMTP is not configured. Copy the setup link and send it to {adminEmail}.
			{/if}
		</li>
		<li>They open the link on <code>{slug}.localhost</code> and choose a password.</li>
		<li>They sign in at the tenant login URL and open the shop dashboard to finish menu setup.</li>
	</ol>

	<div class="flex flex-wrap gap-2 my-4">
		<button type="button" class="btn btn-primary text-sm" onclick={() => copy(setupUrl, 'Setup link')}>
			Copy setup link
		</button>
		{#if storefrontUrl}
			<a class="btn btn-ghost text-sm" href={storefrontUrl} target="_blank" rel="noopener">Open storefront</a>
		{/if}
		<a class="btn btn-ghost text-sm" href={loginUrl} target="_blank" rel="noopener">Open tenant login</a>
		{#if shopUrl}
			<a class="btn btn-ghost text-sm" href={shopUrl} target="_blank" rel="noopener">Open shop (after login)</a>
		{/if}
	</div>

	<dl class="credential-list">
		<div class="credential-row">
			<dt>Business</dt>
			<dd>{tenantName}</dd>
		</div>
		<div class="credential-row">
			<dt>Slug / host</dt>
			<dd><code>{slug}</code></dd>
		</div>
		{#if plan}
			<div class="credential-row">
				<dt>Plan</dt>
				<dd>{plan}</dd>
			</div>
		{/if}
		<div class="credential-row">
			<dt>Admin email</dt>
			<dd class="flex flex-wrap items-center gap-2">
				<span>{adminEmail}</span>
				<button type="button" class="btn btn-ghost text-xs" onclick={() => copy(adminEmail, 'Email')}>
					Copy
				</button>
			</dd>
		</div>
		<div class="credential-row">
			<dt>Password setup</dt>
			<dd class="flex flex-col gap-2 items-start">
				<code class="credential-code">{setupUrl}</code>
			</dd>
		</div>
		<div class="credential-row">
			<dt>Store login</dt>
			<dd>
				<a href={loginUrl} target="_blank" rel="noopener noreferrer" class="text-sm font-medium">
					{loginUrl}
				</a>
			</dd>
		</div>
	</dl>
</div>
