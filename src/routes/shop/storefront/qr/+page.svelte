<script lang="ts">
	import { onMount } from 'svelte';
	import Copy from '@lucide/svelte/icons/copy';
	import Download from '@lucide/svelte/icons/download';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import { toast } from '$lib/components/admin/toast';
	import { storefrontAdminApi, type AdminQr } from '$lib/storefront/admin';
	import type { AdminStorefront } from '$lib/storefront/admin';
	import Skeleton from '$lib/components/admin/Skeleton.svelte';
	import ErrorState from '$lib/components/admin/ErrorState.svelte';

	/**
	 * QR code.
	 *
	 * The code points at the tenant's own subdomain, generated server-side from
	 * the slug the platform resolved — not assembled in the browser, so what is
	 * printed is exactly the address customers should open.
	 *
	 * The code is rendered in the tenant's brand colour, with a contrast check
	 * that darkens a too-light brand colour rather than printing an unscannable
	 * sticker.
	 */
	let { config }: { config: AdminStorefront } = $props();

	let qr = $state<AdminQr | null>(null);
	let loading = $state(true);
	let error = $state('');
	let copied = $state(false);

	async function load() {
		loading = true;
		try {
			qr = await storefrontAdminApi.qr();
			error = '';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not generate the QR code';
		} finally {
			loading = false;
		}
	}

	onMount(load);

	async function copyUrl() {
		if (!qr) return;
		try {
			await navigator.clipboard.writeText(qr.url);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Clipboard access is blocked in some browsers; the URL is on screen to
			// copy by hand, so say so rather than failing silently.
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

{#if loading}
	<div class="panel">
		<Skeleton height="1.2rem" width="10rem" />
		<div style="margin-top:1rem;"><Skeleton height="240px" width="240px" /></div>
	</div>
{:else if error}
	<ErrorState message={error} />
{:else if qr}
	<div class="panel">
		<div class="panel-h">
			<h2 style="margin:0;">Share your storefront</h2>
			<p class="panel-note" style="margin:0.2rem 0 0;">
				Print this on a table tent, a menu sticker or a takeaway leaflet. Customers scan it with
				their camera and land straight on your menu.
			</p>
		</div>

		<div class="sfqr" style="margin-top:1.1rem;">
			<div class="sfqr-code">
				<!--
					`html` inserts the inline SVG the server generated, so the code scales
					from a phone screen to an A4 print without a second download. The
					markup is built server-side from a fixed template around the QR
					module grid — it contains no tenant-supplied text.
				-->
				{@html qr.qr.svg}
			</div>

			<div style="display:grid;gap:0.85rem;min-width:0;">
				<div>
					<p class="field-label" style="margin:0 0 0.3rem;">Your store address</p>
					<div class="sfqr-url">{qr.url}</div>
				</div>

				{#if !qr.published}
					<div class="alert alert-warn">
						Your storefront is not published yet, so this code leads to a hidden store.
						Publish it from the overview screen.
					</div>
				{/if}

				<div style="display:flex;flex-wrap:wrap;gap:0.4rem;">
					<button class="btn btn-primary btn-sm" type="button" onclick={download}>
						<Download size={14} strokeWidth={2} />
						Download PNG
					</button>
					<button class="btn btn-secondary btn-sm" type="button" onclick={copyUrl}>
						<Copy size={14} strokeWidth={2} />
						{copied ? 'Copied' : 'Copy address'}
					</button>
					<a class="btn btn-secondary btn-sm" href={qr.url} target="_blank" rel="noopener">
						<ExternalLink size={14} strokeWidth={2} />
						Open storefront
					</a>
				</div>

				<div>
					<p class="field-label" style="margin:0 0 0.3rem;">Printing</p>
					<ul style="margin:0;padding-left:1.1rem;display:grid;gap:0.25rem;color:var(--text-2);font-size:0.8125rem;line-height:1.5;">
						<li>Print at least 4 cm across so a phone camera locks on.</li>
						<li>Keep it on a light background; a dark panel behind the code will not scan.</li>
						<li>Test it with your own phone before you print a batch.</li>
					</ul>
				</div>

				<div>
					<p class="field-label" style="margin:0 0 0.3rem;">Text version</p>
					<p style="margin:0;font-size:0.8125rem;color:var(--text-2);line-height:1.5;">
						Some customers will type it in rather than scan it. The address is
						<span style="font-family:var(--font-mono);word-break:break-all;">{qr.host}</span>
					</p>
				</div>
			</div>
		</div>
	</div>
{/if}
