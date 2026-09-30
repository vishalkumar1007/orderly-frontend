<script lang="ts">
	import { onMount } from 'svelte';
	import Download from '@lucide/svelte/icons/download';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import type { AdminQr, AdminStorefront } from '$lib/storefront/admin';
	import {
		downloadDataUrl,
		drawImageContain,
		loadImage,
		roundRect,
		slugifyFilename
	} from './marketingCanvas';
	import type { MarketingAsset } from './types';
	import { MARKETING_ASSETS } from './types';
	import MarketingQr from './MarketingQr.svelte';
	import { toast } from '$lib/components/admin/toast';

	let {
		asset = $bindable('qr' as MarketingAsset),
		config,
		qr,
		qrLoading = false,
		qrError = '',
		onRetryQr,
		onAssetChange
	}: {
		asset?: MarketingAsset;
		config: AdminStorefront;
		qr: AdminQr | null;
		qrLoading?: boolean;
		qrError?: string;
		onRetryQr: () => void;
		onAssetChange?: (asset: MarketingAsset) => void;
	} = $props();

	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let rendering = $state(false);
	let previewUrl = $state('');

	const name = $derived(config.store?.name || 'Your store');
	const tagline = $derived(config.store?.tagline || '');
	const logoUrl = $derived(config.store?.logo_url || '');
	const primary = $derived(config.theme?.primary || '#d7263d');
	const url = $derived(qr?.url || config.public_url || '');
	const host = $derived(
		qr?.host || (config.public_url ? safeHost(config.public_url) : '')
	);
	const published = $derived(qr ? qr.published : (config.behaviour?.published ?? false));

	function safeHost(raw: string): string {
		try {
			return new URL(raw).host;
		} catch {
			return '';
		}
	}

	const ASSET_META: Record<
		Exclude<MarketingAsset, 'qr'>,
		{ label: string; hint: string; w: number; h: number; filename: string }
	> = {
		card: {
			label: 'Business card',
			hint: 'Printable card (~85×55 mm). Logo, name, tagline and QR.',
			w: 1050,
			h: 600,
			filename: 'business-card'
		},
		thumbnail: {
			label: 'Thumbnail',
			hint: 'Square share image (1080×1080) for social posts and WhatsApp.',
			w: 1080,
			h: 1080,
			filename: 'thumbnail'
		},
		banner: {
			label: 'Print banner',
			hint: 'Wide strip (1200×630) for posters, social covers and leaflets.',
			w: 1200,
			h: 630,
			filename: 'banner'
		}
	};

	function selectAsset(next: MarketingAsset) {
		if (asset === next) return;
		asset = next;
		onAssetChange?.(next);
	}

	async function renderAsset() {
		if (asset === 'qr' || !canvasEl) return;
		const meta = ASSET_META[asset];
		rendering = true;
		try {
			const canvas = canvasEl;
			canvas.width = meta.w;
			canvas.height = meta.h;
			const ctx = canvas.getContext('2d');
			if (!ctx) throw new Error('Canvas unavailable');

			let logo: HTMLImageElement | null = null;
			let qrImg: HTMLImageElement | null = null;
			if (logoUrl) {
				try {
					logo = await loadImage(logoUrl);
				} catch {
					logo = null;
				}
			}
			if (qr?.qr?.png) {
				try {
					qrImg = await loadImage(qr.qr.png);
				} catch {
					qrImg = null;
				}
			}

			if (asset === 'card') drawCard(ctx, meta.w, meta.h, logo, qrImg);
			else if (asset === 'thumbnail') drawThumbnail(ctx, meta.w, meta.h, logo);
			else drawBanner(ctx, meta.w, meta.h, logo, qrImg);

			previewUrl = canvas.toDataURL('image/png');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not render asset');
			previewUrl = '';
		} finally {
			rendering = false;
		}
	}

	function drawCard(
		ctx: CanvasRenderingContext2D,
		w: number,
		h: number,
		logo: HTMLImageElement | null,
		qrImg: HTMLImageElement | null
	) {
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, w, h);
		ctx.fillStyle = primary;
		ctx.fillRect(0, 0, 18, h);

		const pad = 56;
		if (logo) {
			drawImageContain(ctx, logo, pad, pad, 120, 120);
		} else {
			ctx.fillStyle = primary;
			roundRect(ctx, pad, pad, 120, 120, 20);
			ctx.fill();
			ctx.fillStyle = '#fff';
			ctx.font = '700 42px system-ui, sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText((name[0] || 'S').toUpperCase(), pad + 60, pad + 62);
		}

		ctx.textAlign = 'left';
		ctx.textBaseline = 'alphabetic';
		ctx.fillStyle = '#111827';
		ctx.font = '700 48px system-ui, sans-serif';
		ctx.fillText(truncate(name, 22), pad + 150, pad + 58);
		if (tagline) {
			ctx.fillStyle = '#6b7280';
			ctx.font = '500 28px system-ui, sans-serif';
			ctx.fillText(truncate(tagline, 36), pad + 150, pad + 102);
		}

		ctx.fillStyle = '#9ca3af';
		ctx.font = '500 24px ui-monospace, monospace';
		ctx.fillText(truncate(host || url, 40), pad, h - pad);

		if (qrImg) {
			const qs = 220;
			ctx.fillStyle = '#f3f4f6';
			roundRect(ctx, w - pad - qs - 16, (h - qs) / 2 - 8, qs + 32, qs + 32, 16);
			ctx.fill();
			ctx.drawImage(qrImg, w - pad - qs, (h - qs) / 2, qs, qs);
		}
	}

	function drawThumbnail(
		ctx: CanvasRenderingContext2D,
		w: number,
		h: number,
		logo: HTMLImageElement | null
	) {
		const g = ctx.createLinearGradient(0, 0, w, h);
		g.addColorStop(0, primary);
		g.addColorStop(1, shade(primary, -0.25));
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);

		ctx.fillStyle = 'rgba(255,255,255,0.12)';
		ctx.beginPath();
		ctx.arc(w * 0.85, h * 0.15, 220, 0, Math.PI * 2);
		ctx.fill();

		if (logo) {
			const box = 280;
			ctx.fillStyle = '#ffffff';
			roundRect(ctx, (w - box) / 2, h * 0.22, box, box, 48);
			ctx.fill();
			drawImageContain(ctx, logo, (w - box) / 2 + 28, h * 0.22 + 28, box - 56, box - 56);
		} else {
			ctx.fillStyle = 'rgba(255,255,255,0.95)';
			ctx.font = '700 120px system-ui, sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText((name[0] || 'S').toUpperCase(), w / 2, h * 0.38);
		}

		ctx.textAlign = 'center';
		ctx.fillStyle = '#ffffff';
		ctx.font = '700 64px system-ui, sans-serif';
		ctx.fillText(truncate(name, 20), w / 2, h * 0.62);
		if (tagline) {
			ctx.font = '500 34px system-ui, sans-serif';
			ctx.fillStyle = 'rgba(255,255,255,0.88)';
			ctx.fillText(truncate(tagline, 40), w / 2, h * 0.7);
		}
		ctx.font = '600 28px system-ui, sans-serif';
		ctx.fillStyle = 'rgba(255,255,255,0.75)';
		ctx.fillText('Order online', w / 2, h * 0.82);
	}

	function drawBanner(
		ctx: CanvasRenderingContext2D,
		w: number,
		h: number,
		logo: HTMLImageElement | null,
		qrImg: HTMLImageElement | null
	) {
		const g = ctx.createLinearGradient(0, 0, w, 0);
		g.addColorStop(0, shade(primary, -0.15));
		g.addColorStop(1, primary);
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);

		const pad = 56;
		if (logo) {
			ctx.fillStyle = '#ffffff';
			roundRect(ctx, pad, pad, 140, 140, 28);
			ctx.fill();
			drawImageContain(ctx, logo, pad + 18, pad + 18, 104, 104);
		}

		ctx.textAlign = 'left';
		ctx.textBaseline = 'alphabetic';
		ctx.fillStyle = '#ffffff';
		ctx.font = '700 64px system-ui, sans-serif';
		ctx.fillText(truncate(name, 28), pad + (logo ? 170 : 0), pad + 70);
		ctx.font = '500 32px system-ui, sans-serif';
		ctx.fillStyle = 'rgba(255,255,255,0.9)';
		ctx.fillText(tagline ? truncate(tagline, 48) : 'Scan to order', pad + (logo ? 170 : 0), pad + 120);

		ctx.font = '600 26px system-ui, sans-serif';
		ctx.fillText(truncate(host || url, 42), pad, h - pad);

		if (qrImg) {
			const qs = 220;
			ctx.fillStyle = '#ffffff';
			roundRect(ctx, w - pad - qs - 24, (h - qs) / 2 - 12, qs + 48, qs + 48, 20);
			ctx.fill();
			ctx.drawImage(qrImg, w - pad - qs, (h - qs) / 2, qs, qs);
			ctx.fillStyle = '#374151';
			ctx.font = '600 22px system-ui, sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText('Scan to order', w - pad - qs / 2, (h - qs) / 2 + qs + 28);
		}
	}

	function truncate(text: string, max: number): string {
		const t = (text || '').trim();
		if (t.length <= max) return t;
		return t.slice(0, max - 1) + '…';
	}

	function shade(hex: string, amount: number): string {
		const raw = hex.replace('#', '');
		if (raw.length !== 6) return hex;
		const num = parseInt(raw, 16);
		const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
		const r = clamp(((num >> 16) & 255) * (1 + amount));
		const g = clamp(((num >> 8) & 255) * (1 + amount));
		const b = clamp((num & 255) * (1 + amount));
		return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
	}

	function downloadPng() {
		if (!previewUrl || asset === 'qr') return;
		const meta = ASSET_META[asset];
		downloadDataUrl(previewUrl, `orderly-${slugifyFilename(name)}-${meta.filename}.png`);
	}

	$effect(() => {
		// Depend on asset + branding inputs so previews refresh.
		void asset;
		void name;
		void tagline;
		void logoUrl;
		void primary;
		void qr?.qr?.png;
		if (asset !== 'qr') {
			queueMicrotask(() => void renderAsset());
		}
	});

	onMount(() => {
		if (asset !== 'qr') void renderAsset();
	});
</script>

<div class="mkt-studio">
	<div class="mkt-switcher" role="tablist" aria-label="Marketing asset">
		{#each MARKETING_ASSETS as key (key)}
			<button
				type="button"
				role="tab"
				class="mkt-chip"
				class:active={asset === key}
				aria-selected={asset === key}
				onclick={() => selectAsset(key)}
			>
				{key === 'qr'
					? 'QR code'
					: key === 'card'
						? 'Business card'
						: key === 'thumbnail'
							? 'Thumbnail'
							: 'Banner'}
			</button>
		{/each}
	</div>

	{#if asset === 'qr'}
		<MarketingQr
			{qr}
			loading={qrLoading}
			error={qrError}
			effectiveUrl={url}
			effectiveHost={host}
			isPublished={published}
			onRetry={onRetryQr}
		/>
	{:else}
		{@const meta = ASSET_META[asset]}
		<div class="panel mkt-panel">
			<div class="mkt-asset-head">
				<div>
					<h2 style="margin:0;">{meta.label}</h2>
					<p class="panel-note" style="margin:0.25rem 0 0;">{meta.hint}</p>
				</div>
				<div class="mkt-actions">
					<button
						class="btn btn-secondary btn-sm"
						type="button"
						disabled={rendering}
						onclick={() => renderAsset()}
					>
						<RefreshCw size={14} strokeWidth={2} />
						Refresh
					</button>
					<button
						class="btn btn-primary btn-sm"
						type="button"
						disabled={!previewUrl || rendering}
						onclick={downloadPng}
					>
						<Download size={14} strokeWidth={2} />
						Download PNG
					</button>
				</div>
			</div>

			<div class="mkt-preview-wrap" data-asset={asset}>
				{#if rendering && !previewUrl}
					<p class="mkt-preview-empty">Rendering…</p>
				{:else if previewUrl}
					<img class="mkt-preview-img" src={previewUrl} alt="{meta.label} preview" />
				{:else}
					<p class="mkt-preview-empty">Preview will appear here.</p>
				{/if}
			</div>

			<canvas bind:this={canvasEl} class="mkt-canvas-hidden" aria-hidden="true"></canvas>

			<ul class="mkt-tips">
				<li>Uses your live logo, colours and store link from Customize branding.</li>
				<li>Download PNG, then print or share — these files are not stored on the server.</li>
				{#if asset !== 'thumbnail'}
					<li>Includes your QR when available so customers can scan to order.</li>
				{/if}
			</ul>
		</div>
	{/if}
</div>

<style>
	.mkt-studio {
		display: grid;
		gap: 1rem;
	}
	.mkt-switcher {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.mkt-chip {
		border: 1px solid var(--border);
		background: var(--surface-2);
		color: var(--text-2);
		font: inherit;
		font-size: var(--fs-body, 0.875rem);
		font-weight: 600;
		padding: 0.45rem 0.85rem;
		border-radius: 999px;
		cursor: pointer;
	}
	.mkt-chip:hover {
		color: var(--text);
		border-color: var(--border-strong, var(--border));
	}
	.mkt-chip.active {
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
		color: var(--text);
	}
	.mkt-panel {
		padding: 1.15rem 1.25rem;
	}
	.mkt-asset-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 1rem;
	}
	.mkt-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.mkt-preview-wrap {
		display: grid;
		place-items: center;
		min-height: 14rem;
		padding: 1rem;
		border: 1px dashed var(--border);
		border-radius: var(--radius, 8px);
		background: var(--surface-2);
		overflow: auto;
	}
	.mkt-preview-wrap[data-asset='card'] .mkt-preview-img {
		max-width: min(100%, 420px);
	}
	.mkt-preview-wrap[data-asset='thumbnail'] .mkt-preview-img {
		max-width: min(100%, 320px);
	}
	.mkt-preview-wrap[data-asset='banner'] .mkt-preview-img {
		max-width: 100%;
	}
	.mkt-preview-img {
		width: 100%;
		height: auto;
		border-radius: 8px;
		box-shadow: 0 8px 24px color-mix(in srgb, var(--text) 12%, transparent);
		background: #fff;
	}
	.mkt-preview-empty {
		margin: 0;
		color: var(--text-3);
		font-size: var(--fs-body);
	}
	.mkt-canvas-hidden {
		position: absolute;
		width: 0;
		height: 0;
		opacity: 0;
		pointer-events: none;
	}
	.mkt-tips {
		margin: 0.9rem 0 0;
		padding-left: 1.1rem;
		display: grid;
		gap: 0.25rem;
		color: var(--text-2);
		font-size: var(--fs-body);
		line-height: 1.45;
	}
</style>
