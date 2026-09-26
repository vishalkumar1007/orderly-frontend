<script lang="ts">
	import Copy from '@lucide/svelte/icons/copy';
	import Mail from '@lucide/svelte/icons/mail';
	import Modal from './Modal.svelte';
	import { toast } from './toast';

	let {
		open = $bindable(false),
		setupUrl = '',
		email = '',
		emailSent = false,
		emailError = '',
		heading = 'Setup link ready'
	}: {
		open?: boolean;
		setupUrl?: string;
		email?: string;
		emailSent?: boolean;
		emailError?: string;
		heading?: string;
	} = $props();

	async function copy() {
		try {
			await navigator.clipboard.writeText(setupUrl);
			toast.success('Setup link copied');
		} catch {
			toast.error('Copy failed');
		}
	}
</script>

<Modal bind:open title={heading}>
	<p style="margin:0 0 0.85rem;">
		{#if emailSent}
			Emailed to <strong>{email}</strong>. The link is single-use and expires.
		{:else if emailError}
			Email failed ({emailError}). Share the link below manually.
		{:else}
			SMTP isn't configured, so nothing was emailed. Share the link below manually.
		{/if}
	</p>

	<div class="invite-box">
		<code>{setupUrl}</code>
		<button
			type="button"
			class="btn btn-ghost btn-sm"
			aria-label="Copy setup link"
			onclick={copy}
		>
			<Copy size={13} strokeWidth={2} />
			Copy
		</button>
	</div>

	{#snippet footer()}
		<button type="button" class="btn btn-ghost" onclick={() => (open = false)}>Close</button>
	{/snippet}
</Modal>

<style>
	.invite-box {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.5rem 0.5rem 0.65rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
	}

	.invite-box code {
		flex: 1;
		min-width: 0;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		word-break: break-all;
		color: var(--text-2);
	}
</style>
