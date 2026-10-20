<script lang="ts">
	import { env } from '$env/dynamic/public';
	import CloudOff from '@tabler/icons-svelte/icons/cloud-off';
	import ServerOff from '@tabler/icons-svelte/icons/server-off';
	import Refresh from '@tabler/icons-svelte/icons/refresh';
	import Flag from '@tabler/icons-svelte/icons/flag';

	/**
	 * Full-screen blocker for a page whose required data did not load.
	 *
	 * A page rendered without its data (the default accent, a placeholder
	 * name) looks like a different product. Blocking with an honest error is
	 * better than a page that pretends to work.
	 */
	let {
		code = '',
		status = 0,
		message = '',
		onRetry
	}: {
		code?: string;
		status?: number;
		message?: string;
		/** Defaults to a full reload, which re-runs every server load. */
		onRetry?: () => unknown;
	} = $props();

	const offline = $derived(status === 0 || code === 'network_error' || code === 'timeout');
	const title = $derived(offline ? "We can't reach our servers" : 'Something went wrong on our side');
	const lead = $derived(
		offline
			? 'Check your internet connection, then try again.'
			: "Our server ran into a problem. It's not you. Please try again in a moment."
	);

	const at = new Date().toISOString();
	let retrying = $state(false);
	let reported = $state(false);

	const details = $derived(
		[
			`Error: ${code || 'unknown'}${status ? ` (HTTP ${status})` : ''}`,
			message && `Message: ${message}`,
			typeof location !== 'undefined' && `Page: ${location.href}`,
			`Time: ${at}`
		]
			.filter(Boolean)
			.join('\n')
	);

	async function retry() {
		retrying = true;
		try {
			if (onRetry) await onRetry();
			else location.reload();
		} finally {
			retrying = false;
		}
	}

	async function report() {
		const to = env.PUBLIC_SUPPORT_EMAIL;
		if (to) {
			const q = new URLSearchParams({ subject: `Server error: ${code || status || 'unknown'}`, body: details });
			location.href = `mailto:${to}?${q.toString().replace(/\+/g, '%20')}`;
		}
		try {
			await navigator.clipboard.writeText(details);
		} catch {
			/* clipboard blocked: the details stay visible below */
		}
		reported = true;
	}
</script>

<main class="svc-error" role="alert" aria-live="assertive">
	<div class="svc-card">
		<div class="svc-icon" aria-hidden="true">
			{#if offline}
				<CloudOff size={28} stroke={1.6} />
			{:else}
				<ServerOff size={28} stroke={1.6} />
			{/if}
		</div>
		<h1>{title}</h1>
		<p class="svc-lead">{lead}</p>

		<div class="svc-actions">
			<button class="btn btn-primary" type="button" disabled={retrying} onclick={retry}>
				<Refresh size={16} stroke={1.8} aria-hidden="true" />
				{retrying ? 'Retrying…' : 'Try again'}
			</button>
			<button class="btn btn-ghost" type="button" onclick={report}>
				<Flag size={16} stroke={1.8} aria-hidden="true" />
				{reported ? 'Details copied' : 'Report problem'}
			</button>
		</div>

		<details class="svc-details">
			<summary>Error details</summary>
			<pre>{details}</pre>
		</details>
	</div>
</main>

<style>
	.svc-error {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 1.5rem 1rem;
		background: var(--bg);
		color: var(--text);
	}
	.svc-card {
		width: 100%;
		max-width: 26rem;
		text-align: center;
	}
	.svc-icon {
		display: grid;
		place-items: center;
		width: 64px;
		height: 64px;
		margin: 0 auto 1.25rem;
		border-radius: 50%;
		background: var(--danger-soft);
		color: var(--danger);
	}
	h1 {
		margin: 0 0 0.5rem;
		font-family: var(--font-display);
		font-size: var(--fs-h1);
		font-weight: 700;
		letter-spacing: -0.02em;
	}
	.svc-lead {
		margin: 0;
		color: var(--text-2);
		font-size: var(--fs-body);
		line-height: 1.5;
	}
	.svc-actions {
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 1.5rem;
	}
	.svc-actions .btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}
	.svc-details {
		margin-top: 1.5rem;
		text-align: left;
		font-size: 0.8125rem;
		color: var(--text-3);
	}
	.svc-details summary {
		cursor: pointer;
		text-align: center;
	}
	.svc-details pre {
		margin: 0.75rem 0 0;
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		white-space: pre-wrap;
		word-break: break-word;
		font-size: 0.75rem;
	}
</style>
