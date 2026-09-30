<script lang="ts">
	import Copy from '@lucide/svelte/icons/copy';
	import Download from '@lucide/svelte/icons/download';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import { toast } from '$lib/components/admin/toast';
	import type { AdminQr } from '$lib/storefront/admin';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';

	let {
		qr,
		loading = false,
		error = '',
		effectiveUrl = '',
		effectiveHost = '',
		isPublished = false,
		onRetry
	}: {
		qr: AdminQr | null;
		loading?: boolean;
		error?: string;
		effectiveUrl?: string;
		effectiveHost?: string;
		isPublished?: boolean;
		onRetry: () => void;
	} = $props();

	let copied = $state(false);

	async function copyUrl() {
		if (!effectiveUrl) return;
		try {
			await navigator.clipboard.writeText(effectiveUrl);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			toast.error('Could not copy automatically — select the address above instead');
		}
	}

	function download() {
		if (!qr) return;
		const link = document.createElement('a');
		link.href = qr.qr.png;
		link.download = qr.download_name;
		link.click();
	}
</script>

<div class="panel mkt-panel">
	<div class="panel-h">
		<h2 style="margin:0;">QR code</h2>
		<p class="panel-note" style="margin:0.2rem 0 0;">
			Print this on a table tent, menu sticker or takeaway leaflet. Customers scan and land on your
			menu.
		</p>
	</div>

	{#if error}
		<div
			class="alert alert-danger"
			style="margin-top:0.9rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;"
		>
			<div>
				<strong>QR service notice:</strong>
				{error}
			</div>
			<button class="btn btn-primary btn-sm" type="button" disabled={loading} onclick={onRetry}>
				{loading ? 'Retrying…' : 'Retry QR generation'}
			</button>
		</div>
	{/if}

	<div class="sfqr" style="margin-top:1.1rem;">
		<div class="sfqr-code" style="min-height:200px;display:grid;place-items:center;">
			{#if loading}
				<Skeleton height="200px" width="200px" />
			{:else if qr}
				{@html qr.qr.svg}
			{:else}
				<div style="padding:1.5rem;text-align:center;color:var(--text-2);font-size:var(--fs-body);">
					<p style="margin:0 0 0.5rem;">QR code unavailable</p>
					<button class="btn btn-secondary btn-sm" type="button" onclick={onRetry}>Generate QR</button>
				</div>
			{/if}
		</div>

		<div style="display:grid;gap:0.85rem;min-width:0;">
			<div>
				<p class="field-label" style="margin:0 0 0.3rem;">Your store address</p>
				<div class="sfqr-url">{effectiveUrl || 'Loading address…'}</div>
			</div>

			{#if !isPublished}
				<div class="alert alert-warn">
					Your storefront is not published yet, so this code leads to a hidden store. Publish it from
					the <a href="?tab=publish">Publish</a> tab.
				</div>
			{/if}

			<div style="display:flex;flex-wrap:wrap;gap:0.4rem;">
				{#if qr}
					<button class="btn btn-primary btn-sm" type="button" onclick={download}>
						<Download size={14} strokeWidth={2} />
						Download PNG
					</button>
				{/if}
				{#if effectiveUrl}
					<button class="btn btn-secondary btn-sm" type="button" onclick={copyUrl}>
						<Copy size={14} strokeWidth={2} />
						{copied ? 'Copied' : 'Copy address'}
					</button>
					<a class="btn btn-secondary btn-sm" href={effectiveUrl} target="_blank" rel="noopener">
						<ExternalLink size={14} strokeWidth={2} />
						Open storefront
					</a>
				{/if}
			</div>

			<div>
				<p class="field-label" style="margin:0 0 0.3rem;">Printing</p>
				<ul
					style="margin:0;padding-left:1.1rem;display:grid;gap:0.25rem;color:var(--text-2);font-size:var(--fs-body);line-height:1.5;"
				>
					<li>Print at least 4 cm across so a phone camera locks on.</li>
					<li>Keep it on a light background; a dark panel behind the code will not scan.</li>
					<li>Test it with your own phone before you print a batch.</li>
				</ul>
			</div>

			<div>
				<p class="field-label" style="margin:0 0 0.3rem;">Text version</p>
				<p style="margin:0;font-size:var(--fs-body);color:var(--text-2);line-height:1.5;">
					Some customers will type it in rather than scan it. The address is
					<span style="font-family:var(--font-mono);word-break:break-all;">
						{effectiveHost || effectiveUrl || 'your store link'}
					</span>
				</p>
			</div>
		</div>
	</div>
</div>
